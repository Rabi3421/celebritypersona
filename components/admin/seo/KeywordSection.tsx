"use client";

import { useEffect, useRef, useState } from "react";
import { keywordClashes } from "@/lib/seo-checks";
import styles from "@/app/admin/panel.module.css";
import { fillField, useOutfitSeo } from "./OutfitSeoContext";
import { useAdminSession } from "@/components/admin/session/AdminSession";

const MAX_SECONDARY = 5;

/**
 * The first thing on the form, because the research comes before the writing:
 * the one phrase this page targets, the few that support it, and two links to
 * check them against what people actually search.
 */
export function KeywordSection({
  primary,
  secondary,
  error,
}: {
  primary?: string;
  secondary: string[];
  error?: string;
}) {
  const { formId, snapshot, owners, outfitId } = useOutfitSeo();
  const keyword = snapshot?.primaryKeyword ?? primary ?? "";
  const clashes = keywordClashes(keyword, owners, outfitId);
  const [chips, setChips] = useState(secondary);
  const suggestions = useSuggestions(keyword);

  const addChip = (value: string) => {
    const clean = value.trim().toLowerCase().replace(/\s+/g, " ");
    if (!clean) return;
    setChips((current) =>
      current.includes(clean) || current.length >= MAX_SECONDARY ? current : [...current, clean],
    );
  };

  return (
    <div className={`${styles.keywordBox} ${styles.wide}`}>
      <h3 className={styles.subhead}>Target keyword</h3>

      <div className={styles.field}>
        <label htmlFor="primaryKeyword">Primary keyword</label>
        <input
          id="primaryKeyword"
          name="primaryKeyword"
          defaultValue={primary}
          placeholder="e.g. rukmini vasanth black dress"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
        />
        <small>
          The one search this page should rank for — required to publish. It is never shown on the
          page or emitted as a meta tag; the title, H1, slug, first paragraph and description are
          checked against it.
        </small>
        {error ? <p className={styles.bad}>{error}</p> : null}
      </div>

      <p className={styles.keywordLinks}>
        <a
          href={`https://www.google.com/search?${new URLSearchParams({ q: keyword || snapshot?.celebrity || "", gl: "in", hl: "en" })}`}
          target="_blank"
          rel="noreferrer"
        >
          Google this keyword ↗
        </a>
        <a
          href={`https://trends.google.com/trends/explore?${new URLSearchParams({ geo: "IN", q: snapshot?.celebrity || keyword })}`}
          target="_blank"
          rel="noreferrer"
        >
          Google Trends for {snapshot?.celebrity || "the celebrity"} ↗
        </a>
      </p>

      {suggestions.length ? (
        <div className={styles.suggestions}>
          <span>People also search</span>
          {suggestions.map((suggestion) => (
            <span key={suggestion} className={styles.suggestion}>
              <button type="button" onClick={() => fillField(formId, "primaryKeyword", suggestion)}>
                {suggestion}
              </button>
              <button
                type="button"
                aria-label={`Add “${suggestion}” as a secondary keyword`}
                onClick={() => addChip(suggestion)}
              >
                +
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {clashes.length ? (
        <p className={styles.notice} role="status">
          <strong>Another look already targets this keyword</strong>
          {clashes.map((owner) => (
            <span key={owner.id}>
              “{owner.title}” — /outfits/{owner.slug} {owner.published ? "(published)" : "(draft)"}
            </span>
          ))}
          Two pages on one search compete with each other. Pick a more specific phrase.
        </p>
      ) : null}

      <div className={styles.field}>
        <label htmlFor="secondaryKeyword-new">Secondary keywords ({chips.length}/{MAX_SECONDARY})</label>
        <div className={styles.chipsInput}>
          {chips.map((chip) => (
            <span key={chip} className={styles.chip}>
              {chip}
              <button
                type="button"
                aria-label={`Remove ${chip}`}
                onClick={() => setChips((current) => current.filter((value) => value !== chip))}
              >
                ×
              </button>
            </span>
          ))}
          {chips.length < MAX_SECONDARY ? (
            <input
              id="secondaryKeyword-new"
              placeholder="e.g. club l london dress"
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addChip(event.currentTarget.value);
                  event.currentTarget.value = "";
                }
              }}
              onBlur={(event) => {
                addChip(event.currentTarget.value);
                event.currentTarget.value = "";
              }}
            />
          ) : null}
        </div>
        <small>Two to five supporting phrases: the brand and product name, the garment style. Enter adds one.</small>
        <input type="hidden" name="secondaryKeywords" value={chips.join(",")} />
      </div>
    </div>
  );
}

/**
 * Google's autocomplete for what is typed, through our own route. The endpoint
 * is unofficial, so every failure — network, format, rate limit — is an empty
 * list: this is a hint, and it must never get in the way of the form.
 */
function useSuggestions(keyword: string) {
  const { adminFetch } = useAdminSession();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const last = useRef("");

  useEffect(() => {
    const query = keyword.trim();
    if (query.length < 3 || query === last.current) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      last.current = query;
      try {
        const response = await adminFetch(`/api/admin/suggest?${new URLSearchParams({ q: query })}`, {
          signal: controller.signal,
        });
        const data = response.ok ? await response.json() : { suggestions: [] };
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions.slice(0, 8) : []);
      } catch {
        // Aborted or offline: keep whatever was showing.
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [keyword, adminFetch]);

  return keyword.trim().length < 3 ? [] : suggestions;
}
