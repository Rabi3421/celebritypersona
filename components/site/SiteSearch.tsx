"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { SearchIcon } from "./Icons";
import { searchEntries, type SearchEntry } from "@/lib/search";

/**
 * The header search. It was a placeholder input that did nothing.
 *
 * The form posts to /search, which renders the same results on the server, so
 * this works with JavaScript off and the dropdown is the enhancement. The
 * index is fetched once, on first focus, and shared by every mount for the
 * rest of the session — no request is made by anyone who never searches.
 */

let indexPromise: Promise<SearchEntry[]> | null = null;

function loadIndex() {
  indexPromise ??= fetch("/api/search-index")
    .then((response) => (response.ok ? response.json() : []))
    .catch(() => {
      // Offline, or the route is unreachable. The form still submits to
      // /search, so search is degraded rather than broken; allow a retry.
      indexPromise = null;
      return [] as SearchEntry[];
    });
  return indexPromise;
}

const MAX_SUGGESTIONS = 7;

export function SiteSearch() {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapper = useRef<HTMLFormElement>(null);

  const results = index && query.trim() ? searchEntries(index, query, MAX_SUGGESTIONS) : [];

  // A click anywhere else closes the panel; Escape does too, from the input.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current <= 0 ? results.length - 1 : current - 1));
    } else if (event.key === "Enter" && active >= 0) {
      // Only intercept when something is highlighted; otherwise let the form
      // submit through to the full results page.
      event.preventDefault();
      go(results[active].href);
    }
  }

  return (
    <form
      className="navsearch"
      role="search"
      action="/search"
      ref={wrapper}
      onSubmit={() => setOpen(false)}
    >
      <SearchIcon className="ic" />
      <input
        name="q"
        value={query}
        autoComplete="off"
        placeholder="Search a celebrity, occasion or brand"
        aria-label="Search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onFocus={() => {
          setOpen(true);
          if (!index) loadIndex().then(setIndex);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />

      {open && query.trim() ? (
        <div className="navfind" id={listId} role="listbox">
          {results.length > 0 ? (
            <>
              {results.map((entry, position) => (
                <button
                  type="button"
                  key={entry.href}
                  role="option"
                  aria-selected={position === active}
                  className={position === active ? "on" : undefined}
                  onMouseEnter={() => setActive(position)}
                  onClick={() => go(entry.href)}
                >
                  <i>
                    {entry.image ? (
                      <Image src={entry.image} alt="" width={34} height={34} />
                    ) : null}
                  </i>
                  <span>
                    <b>{entry.title}</b>
                    <small>{entry.subtitle}</small>
                  </span>
                  <em>{entry.kind}</em>
                </button>
              ))}
              <button type="submit" className="navfind-all">
                See everything for “{query.trim()}” →
              </button>
            </>
          ) : (
            <p>
              {index === null
                ? "Searching…"
                : `Nothing matches “${query.trim()}”. Try a name, an occasion or a brand.`}
            </p>
          )}
        </div>
      ) : null}
    </form>
  );
}
