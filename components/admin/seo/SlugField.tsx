"use client";

import { useState } from "react";
import { suggestKeywordSlug } from "@/lib/outfit-seo";
import { suggestOutfitSlug } from "@/lib/slugs";
import styles from "@/app/admin/panel.module.css";
import { fillField, useOutfitSeo } from "./OutfitSeoContext";

/**
 * The look's URL segment.
 *
 * Suggested from the primary keyword and the lead piece's label when there is a
 * keyword, and from the old celebrity–piece–label formula when there is not.
 *
 * Once a look has been published the field is locked: its address is a promise
 * to everyone who linked to it. Unlocking is deliberate, says what happens, and
 * posts `slugUnlocked` so the server accepts the change and records the 301.
 */
export function SlugField({
  defaultValue,
  lockedSince,
  error,
}: {
  defaultValue?: string;
  lockedSince?: string;
  error?: string;
}) {
  const { formId, snapshot, takenSlugs } = useOutfitSeo();
  const [unlocked, setUnlocked] = useState(false);
  const locked = Boolean(lockedSince) && !unlocked;

  const suggest = () => {
    if (!snapshot) return;
    const slug =
      suggestKeywordSlug(snapshot, takenSlugs) ??
      suggestOutfitSlug(
        {
          celebrity: snapshot.celebrity,
          event: snapshot.event,
          items: snapshot.items,
        },
        takenSlugs,
      );
    if (slug) fillField(formId, "slug", slug);
  };

  return (
    <div className={`${styles.field} ${styles.wide}`}>
      <label htmlFor="slug">Slug</label>
      <div className={styles.inlineField}>
        <input
          id="slug"
          name="slug"
          defaultValue={defaultValue}
          placeholder="e.g. rukmini-vasanth-black-dress-club-l-london"
          readOnly={locked}
          required
          aria-invalid={error ? true : undefined}
        />
        {locked ? (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => {
              if (
                window.confirm(
                  "This address is live and may be linked or indexed. Changing it moves the page; the old address will 301 to the new one when you save. Unlock?",
                )
              ) {
                setUnlocked(true);
              }
            }}
          >
            Unlock
          </button>
        ) : (
          <button type="button" className={styles.ghost} onClick={suggest}>
            Suggest
          </button>
        )}
      </div>
      {unlocked ? <input type="hidden" name="slugUnlocked" value="on" /> : null}
      <small>
        {locked
          ? `Public since ${lockedSince}. Locked so the address cannot move by accident.`
          : unlocked
            ? "Unlocked. Saving a different slug moves the page and records a 301 from the old address."
            : "Built from the primary keyword plus the label: lowercase, hyphens, no dates. Also names the folder the photos upload into."}
      </small>
      {error ? <p className={styles.bad}>{error}</p> : null}
    </div>
  );
}
