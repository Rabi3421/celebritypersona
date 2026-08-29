"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { celebritySlug } from "@/lib/slugs";
import type { Celebrity } from "@/lib/types";
import styles from "@/app/celebrities/celebrities.module.css";

type SortMode = "looks" | "trend" | "new" | "save" | "az";

function compactPrice(value: number) {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1).replace(/\.0$/, "")}L`;
  if (value >= 1000) return `₹${Math.round(value / 1000)}k`;
  return `₹${value}`;
}

export function CelebrityDirectory({ celebrities }: { celebrities: Celebrity[] }) {
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [letter, setLetter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("looks");
  const [followingOnly, setFollowingOnly] = useState(false);
  const [following, setFollowing] = useState<number[]>([]);
  const [requested, setRequested] = useState(false);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = celebrities.filter((celebrity) => {
      if (letter && !celebrity.name.toUpperCase().startsWith(letter)) return false;
      if (normalizedQuery && !celebrity.name.toLowerCase().includes(normalizedQuery)) return false;
      if (followingOnly && !following.includes(celebrity.id)) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      if (sort === "trend") return Number(Boolean(b.trending)) - Number(Boolean(a.trending)) || b.looks - a.looks;
      if (sort === "new") return Number(Boolean(b.newArchive)) - Number(Boolean(a.newArchive)) || b.id - a.id;
      if (sort === "save") return b.averageSaving - a.averageSaving;
      if (sort === "az") return a.name.localeCompare(b.name);
      return b.looks - a.looks;
    });
  }, [celebrities, following, followingOnly, letter, query, sort]);

  const searchMatches = query.trim()
    ? celebrities.filter((celebrity) => celebrity.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : [];
  const availableLetters = new Set(celebrities.map((celebrity) => celebrity.name[0].toUpperCase()));

  function toggleFollow(id: number) {
    setFollowing(following.includes(id) ? following.filter((value) => value !== id) : [...following, id]);
  }

  function resetFilters() {
    setQuery("");
    setLetter(null);
    setFollowingOnly(false);
  }

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequested(true);
  }

  return (
    <main className={styles.page}>
      <header className={styles.band}>
        <div className={styles.shell}>
          <nav className={styles.crumb} aria-label="Breadcrumb"><Link href="/">Home</Link><i>›</i><span>Celebrities</span></nav>
          <h1>Style archives</h1>
          <p className={styles.lede}>Every look we&apos;ve decoded, organised by person. Follow someone and we&apos;ll tell you when they wear something new.</p>

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
                        <Image src={`https://picsum.photos/seed/cpc${celebrity.id}/80/80`} width={34} height={34} alt="" />
                        <b>{celebrity.name}</b><span>{celebrity.looks} looks</span>
                      </Link>
                    ))}
                  </>
                ) : <div className={styles.noMatch}><b>No archive for “{query}”</b><span>Request this person below.</span></div>}
              </div>
            )}
          </div>

          <div className={styles.stats}>
            <div><b>18</b><span>Archives</span></div>
            <div><b>486</b><span>Looks decoded</span></div>
            <div><b>2,140</b><span>Pieces identified</span></div>
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
            <p><b>{results.length}</b> archives · {celebrities.reduce((sum, celebrity) => sum + celebrity.looks, 0)} looks</p>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} aria-label="Sort celebrities">
              <option value="looks">Most decoded</option><option value="trend">Trending now</option>
              <option value="new">Recently added</option><option value="save">Biggest savings</option><option value="az">A–Z</option>
            </select>
            <button type="button" aria-pressed={followingOnly} onClick={() => setFollowingOnly(!followingOnly)}>♡ Following{following.length ? ` (${following.length})` : ""}</button>
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
              <CelebrityCard celebrity={celebrity} following={following.includes(celebrity.id)} onFollow={() => toggleFollow(celebrity.id)} key={celebrity.id} />
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
          <div><h2>Not seeing someone?</h2><p>Tell us who to decode next. We work through requests weekly — the most-asked-for names get done first.</p></div>
          <form onSubmit={submitRequest}>
            <input required placeholder="Who should we decode?" aria-label="Request a celebrity" />
            <button type="submit">{requested ? "Request received ✓" : "Request"}</button>
          </form>
        </section>
      </div>
    </main>
  );
}

function SpotlightCard({ celebrity, rank }: { celebrity: Celebrity; rank: number }) {
  return (
    <Link className={styles.spotlightCard} href={`/celebrities/${celebritySlug(celebrity)}`}>
      <div className={styles.spotlightImage}><Image src={`https://picsum.photos/seed/cpb${celebrity.id}/700/440`} alt="" fill sizes="(max-width: 1023px) 100vw, 33vw" /><span>#{rank}</span></div>
      <div className={styles.spotlightBody}>
        <Image src={`https://picsum.photos/seed/cpc${celebrity.id}/120/120`} alt="" width={58} height={58} />
        <h2>{celebrity.name}</h2><p>{celebrity.looks} looks · {celebrity.brands[0]}</p>
        <div><span><b>{celebrity.averageSaving}%</b><small>Avg saving</small></span><span><b>{compactPrice(celebrity.low)}–{compactPrice(celebrity.high)}</b><small>Typical range</small></span></div>
      </div>
    </Link>
  );
}

function CelebrityCard({ celebrity, following, onFollow }: { celebrity: Celebrity; following: boolean; onFollow: () => void }) {
  return (
    <article className={styles.card}>
      <Link className={styles.cardMain} href={`/celebrities/${celebritySlug(celebrity)}`}>
        <div className={styles.cardTop}>
          <Image src={`https://picsum.photos/seed/cpc${celebrity.id}/140/140`} width={66} height={66} alt="" />
          <div><h2>{celebrity.name}</h2><p>{celebrity.looks} looks decoded</p><span>{celebrity.trending && <b>Trending</b>}{celebrity.newArchive && <em>New archive</em>}</span></div>
        </div>
        <div className={styles.thumbnails}>{[0, 1, 2].map((index) => <Image key={index} src={`https://picsum.photos/seed/cpt${celebrity.id}${index}/180/240`} width={180} height={240} alt="" />)}</div>
        <div className={styles.cardMeta}><span><b>{celebrity.averageSaving}%</b><small>Avg saving</small></span><span><b>{compactPrice(celebrity.low)}–{compactPrice(celebrity.high)}</b><small>Typical range</small></span></div>
        <p className={styles.brands}>{celebrity.brands.join(" · ")}</p>
      </Link>
      <div className={styles.cardActions}>
        <button type="button" aria-pressed={following} onClick={onFollow}>{following ? "✓ Following" : "♡ Follow"}</button>
        <Link href={`/celebrities/${celebritySlug(celebrity)}`} aria-label={`Open ${celebrity.name} archive`}>→</Link>
      </div>
    </article>
  );
}
