"use client";

import Image from "next/image";
import Link from "next/link";
import { plural } from "@/lib/format";
import { useActionState, useMemo, useState } from "react";
import { requestCelebrity, type AudienceState } from "@/app/actions/audience";
import { celebritySlug } from "@/lib/slugs";
import { useSavedList } from "@/lib/saved";
import type { ArchiveTotals, CelebrityView } from "@/lib/archive";
import styles from "@/app/celebrities/celebrities.module.css";

type SortMode = "looks" | "trend" | "new" | "save" | "az";

function compactPrice(value: number) {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1).replace(/\.0$/, "")}L`;
  if (value >= 1000) return `₹${Math.round(value / 1000)}k`;
  return `₹${value}`;
}

/** A range only reads honestly once both ends are priced. */
function priceRange(low: number | null, high: number | null) {
  if (low === null || high === null) return "—";
  return low === high ? compactPrice(low) : `${compactPrice(low)}–${compactPrice(high)}`;
}

/** Her own photo where the archive has one, so a card is never a stock seed
 *  standing in for a person. */
const portrait = (celebrity: CelebrityView, index = 0) =>
  celebrity.stats.photos[index] ?? celebrity.stats.photos[0];

/**
 * A person with no decoded look yet has no photograph of her on this site.
 * Every one of these frames used to fill with a random picsum photograph under
 * her name; now the frame stays empty rather than showing a stranger.
 */
function Portrait({
  celebrity,
  index = 0,
  describe,
  ...rest
}: {
  celebrity: CelebrityView;
  index?: number;
  /** Set on the large portraits, where the photograph is worth describing to
   *  a reader who cannot see it and to image search. The thumbnail rows sit
   *  beside her name already, so they stay decorative. */
  describe?: boolean;
} & Omit<React.ComponentProps<typeof Image>, "src" | "alt">) {
  const src = portrait(celebrity, index);
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={describe ? `${celebrity.name} in a look decoded on CelebrityPersona` : ""}
      {...rest}
    />
  );
}

export function CelebrityDirectory({
  celebrities,
  totals,
}: {
  celebrities: CelebrityView[];
  totals: ArchiveTotals;
}) {
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [letter, setLetter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("looks");
  const [followingOnly, setFollowingOnly] = useState(false);
  // Follows are kept in the browser and shared with the profile page, so the
  // list survives a refresh instead of emptying on every visit.
  const following = useSavedList("people");
  // Requests are stored and ranked by how often a name is asked for, which is
  // what the copy below promises.
  const [request, requestAction, requesting] = useActionState<AudienceState, FormData>(
    requestCelebrity,
    {},
  );

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = celebrities.filter((celebrity) => {
      if (letter && !celebrity.name.toUpperCase().startsWith(letter)) return false;
      if (normalizedQuery && !celebrity.name.toLowerCase().includes(normalizedQuery)) return false;
      if (followingOnly && !following.has(celebritySlug(celebrity))) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      if (sort === "trend") return Number(b.trending) - Number(a.trending) || b.stats.looks - a.stats.looks;
      if (sort === "new") return Number(b.stats.isNew) - Number(a.stats.isNew) || (b.stats.lastDecoded ?? "").localeCompare(a.stats.lastDecoded ?? "");
      if (sort === "save") return (b.stats.averageSaving ?? -1) - (a.stats.averageSaving ?? -1);
      if (sort === "az") return a.name.localeCompare(b.name);
      return b.stats.looks - a.stats.looks;
    });
  }, [celebrities, following, followingOnly, letter, query, sort]);

  const searchMatches = query.trim()
    ? celebrities.filter((celebrity) => celebrity.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : [];
  const availableLetters = new Set(celebrities.map((celebrity) => celebrity.name[0].toUpperCase()));

  function resetFilters() {
    setQuery("");
    setLetter(null);
    setFollowingOnly(false);
  }

  return (
    <main className={styles.page}>
      <header className={styles.band}>
        <div className={styles.shell}>
          <nav className={styles.crumb} aria-label="Breadcrumb"><Link href="/">Home</Link><i>›</i><span>Celebrities</span></nav>
          <h1>Celebrity style archives</h1>
          <p className={styles.lede}>Every Indian celebrity outfit we&apos;ve decoded, organised by person — the labels, the prices, and the affordable alternatives. Follow someone and we&apos;ll tell you when they wear something new.</p>

          <div className={styles.search}>
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setLetter(null); }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
              placeholder="Search a name — try “alia” or “kap”"
              aria-label="Search celebrities"
              autoComplete="off"
            />
            {searchFocused && query.trim() && (
              <div className={styles.autocomplete}>
                {searchMatches.length ? (
                  <>
                    <p>{searchMatches.length} {searchMatches.length === 1 ? "match" : "matches"}</p>
                    {searchMatches.map((celebrity) => (
                      <Link href={`/celebrities/${celebritySlug(celebrity)}`} key={celebrity.id}>
                        <Portrait celebrity={celebrity} width={34} height={34} />
                        <b>{celebrity.name}</b><span>{plural(celebrity.stats.looks, "look")}</span>
                      </Link>
                    ))}
                  </>
                ) : <div className={styles.noMatch}><b>No archive for “{query}”</b><span>Request this person below.</span></div>}
              </div>
            )}
          </div>

          <div className={styles.stats}>
            <div><b>{celebrities.length}</b><span>Archives</span></div>
            <div><b>{totals.looks.toLocaleString("en-IN")}</b><span>Looks decoded</span></div>
            <div><b>{totals.pieces.toLocaleString("en-IN")}</b><span>Pieces identified</span></div>
          </div>
        </div>
      </header>

      <section className={styles.spotlight}>
        <div className={styles.shell}>
          <div className={styles.spotlightHeading}><span>◆ Most decoded this month</span><i /></div>
          <div className={styles.spotlightGrid}>
            {celebrities.slice(0, 3).map((celebrity, index) => <SpotlightCard celebrity={celebrity} rank={index + 1} key={celebrity.id} />)}
          </div>
        </div>
      </section>

      <div className={styles.toolbar}>
        <div className={styles.shell}>
          <div className={styles.toolbarRow}>
            <p><b>{results.length}</b> {results.length === 1 ? "archive" : "archives"} · {plural(celebrities.reduce((sum, celebrity) => sum + celebrity.stats.looks, 0), "look")}</p>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} aria-label="Sort celebrities">
              <option value="looks">Most decoded</option><option value="trend">Trending now</option>
              <option value="new">Recently added</option><option value="save">Biggest savings</option><option value="az">A–Z</option>
            </select>
            <button type="button" aria-pressed={followingOnly} onClick={() => setFollowingOnly(!followingOnly)}>♡ Following{following.count ? ` (${following.count})` : ""}</button>
          </div>
          <div className={styles.alphabet}>
            <button type="button" className={styles.allLetter} aria-pressed={!letter} onClick={() => setLetter(null)}>All</button>
            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((value) => (
              <button type="button" key={value} disabled={!availableLetters.has(value)} aria-pressed={letter === value} onClick={() => setLetter(value)}>{value}</button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.shell}>
        {results.length ? (
          <div className={styles.grid}>
            {results.map((celebrity) => (
              <CelebrityCard celebrity={celebrity} following={following.has(celebritySlug(celebrity))} onFollow={() => following.toggle(celebritySlug(celebrity))} key={celebrity.id} />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <span>⌕</span><h2>{followingOnly ? "You’re not following anyone yet" : "No archive for that name"}</h2>
            <p>{followingOnly ? "Follow someone and their new looks will show up here first." : "We may not have decoded them yet. Ask for them below and we’ll add them to the queue."}</p>
            <button type="button" onClick={resetFilters}>{followingOnly ? "Browse everyone" : "Clear filters"}</button>
          </div>
        )}

        <section className={styles.request}>
          <div>
            <h2>Not seeing someone?</h2>
            <p>
              {request.done
                ? "Noted — your request is in the queue. The most-asked-for names get done first."
                : request.errors?.name ?? request.errors?.form ?? "Tell us who to decode next. We work through requests weekly — the most-asked-for names get done first."}
            </p>
          </div>
          {request.done ? null : (
            <form action={requestAction}>
              <input
                required
                name="name"
                maxLength={80}
                placeholder="Who should we decode?"
                aria-label="Request a celebrity"
                aria-invalid={request.errors?.name ? true : undefined}
              />
              {/* Invisible to a person, irresistible to a bot. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
              />
              <button type="submit" disabled={requesting}>{requesting ? "Sending…" : "Request"}</button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function SpotlightCard({ celebrity, rank }: { celebrity: CelebrityView; rank: number }) {
  return (
    <Link className={styles.spotlightCard} href={`/celebrities/${celebritySlug(celebrity)}`}>
      <div className={styles.spotlightImage}><Portrait celebrity={celebrity} index={1} describe fill sizes="(max-width: 1023px) 100vw, 33vw" /><span>#{rank}</span></div>
      <div className={styles.spotlightBody}>
        <Portrait celebrity={celebrity} width={58} height={58} />
        <h2>{celebrity.name}</h2><p>{plural(celebrity.stats.looks, "look")}{celebrity.stats.brands[0] ? ` · ${celebrity.stats.brands[0].name}` : ""}</p>
        <div><span><b>{celebrity.stats.averageSaving === null ? "—" : `${celebrity.stats.averageSaving}%`}</b><small>Avg saving</small></span><span><b>{priceRange(celebrity.stats.low, celebrity.stats.high)}</b><small>Typical range</small></span></div>
      </div>
    </Link>
  );
}

function CelebrityCard({ celebrity, following, onFollow }: { celebrity: CelebrityView; following: boolean; onFollow: () => void }) {
  return (
    <article className={styles.card}>
      <Link className={styles.cardMain} href={`/celebrities/${celebritySlug(celebrity)}`}>
        <div className={styles.cardTop}>
          <Portrait celebrity={celebrity} describe width={66} height={66} />
          <div><h2>{celebrity.name}</h2><p>{plural(celebrity.stats.looks, "look")} decoded</p><span>{celebrity.trending && <b>Trending</b>}{celebrity.stats.isNew && <em>New archive</em>}</span></div>
        </div>
        <div className={styles.thumbnails}>{[0, 1, 2].map((index) => <Portrait key={index} celebrity={celebrity} index={index} width={180} height={240} />)}</div>
        <div className={styles.cardMeta}><span><b>{celebrity.stats.averageSaving === null ? "—" : `${celebrity.stats.averageSaving}%`}</b><small>Avg saving</small></span><span><b>{priceRange(celebrity.stats.low, celebrity.stats.high)}</b><small>Typical range</small></span></div>
        <p className={styles.brands}>{celebrity.stats.brands.slice(0, 5).map((brand) => brand.name).join(" · ")}</p>
      </Link>
      <div className={styles.cardActions}>
        <button type="button" aria-pressed={following} onClick={onFollow}>{following ? "✓ Following" : "♡ Follow"}</button>
        <Link href={`/celebrities/${celebritySlug(celebrity)}`} aria-label={`Open ${celebrity.name} archive`}>→</Link>
      </div>
    </article>
  );
}
