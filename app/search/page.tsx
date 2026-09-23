import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { SearchAnalytics } from "@/components/site/SearchAnalytics";
import { buildSearchIndex, searchWithFallback, type SearchEntry, type SearchKind } from "@/lib/search";
import { celebrityTiles, occasionTiles } from "@/lib/archive";
import {
  getCelebrityViews,
  getOccasionViews,
  getPublishedOutfits,
} from "@/lib/db/content";
import { pageMetadata } from "@/lib/seo";
import styles from "./search.module.css";

/**
 * The title used to end up as "Search — CelebrityPersona · CelebrityPersona",
 * because it carried the site name into a template that appends it again.
 *
 * Results pages are query-shaped and endless, so the page stays out of the
 * index; `follow` keeps it useful as a route to everything it links to.
 */
export const metadata: Metadata = pageMetadata({
  title: "Search the archive",
  description: "Search every decoded look, style archive and occasion by name, event or brand.",
  path: "/search",
  index: false,
});

const GROUPS: { kind: SearchKind; label: string }[] = [
  { kind: "Celebrity", label: "Style archives" },
  { kind: "Occasion", label: "Occasions" },
  { kind: "Look", label: "Decoded looks" },
];

/**
 * The page the header search submits to, and the reason search works with
 * JavaScript switched off: the same index and the same ranking, run on the
 * server. An empty query is not an error — it is the front door, so it offers
 * what people are actually searching for.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, outfits, celebrities, occasions] = await Promise.all([
    searchParams,
    getPublishedOutfits(),
    getCelebrityViews(),
    getOccasionViews(),
  ]);

  const query = (q ?? "").trim().slice(0, 120);
  const index = buildSearchIndex({ outfits, celebrities, occasions });
  const outcome = query
    ? searchWithFallback(index, query, 60)
    : { entries: [] as SearchEntry[], partial: false, matched: 0, words: 0 };
  const results = outcome.entries;

  // Something to click when there is nothing to show: what the site is busiest
  // with, taken from the archive rather than a list of guesses.
  /**
   * Things to click when there is nothing to show — and never the query that
   * just failed, which the list could previously repeat straight back when a
   * leaderboard term happened to match what was typed. Built from the people,
   * occasions and labels actually in the archive, so every suggestion returns
   * something.
   */
  const labels = [
    ...new Set(
      outfits.flatMap((outfit) =>
        outfit.items.map((item) => item.wornBrand ?? item.swapBrand).filter(Boolean),
      ),
    ),
  ].slice(0, 3) as string[];

  const asked = query.trim().toLowerCase();
  const ideas = [
    ...celebrityTiles(outfits, 3).map((tile) => tile.name),
    ...occasionTiles(outfits, 3).map((tile) => tile.name),
    ...labels,
  ]
    .filter((value, position, all) => all.indexOf(value) === position)
    .filter((value) => value.trim().toLowerCase() !== asked);

  return (
    <>
      <Nav />
      <SearchAnalytics queryLength={query.length} resultCount={results.length} />
      <main className={styles.page}>
        <header className={styles.band}>
          <div className={`${styles.shell} ${styles.bandInner}`}>
            <nav className={styles.crumb} aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <i>›</i>
              <span>Search</span>
            </nav>
            <h1>
              {query ? (
                <>
                  {results.length} {results.length === 1 ? "result" : "results"} for{" "}
                  <em>{query}</em>
                </>
              ) : (
                "Search the archive"
              )}
            </h1>
            <p className={styles.lede}>
              Every decoded look, style archive and occasion. Brands work too —
              search a label and the looks carrying it come up.
            </p>
            <form className={styles.form} role="search" action="/search">
              <span aria-hidden="true">⌕</span>
              <input
                name="q"
                defaultValue={query}
                placeholder="Try a name, an occasion or a brand"
                aria-label="Search"
                autoFocus={!query}
              />
              <button type="submit">Search</button>
            </form>
          </div>
        </header>

        <div className={styles.shell}>
          {query && results.length === 0 ? (
            <div className={styles.empty}>
              <span aria-hidden="true">⌕</span>
              <h2>Nothing matches “{query}”</h2>
              <p>
                Not one word of that is in the archive yet. These are the
                people, occasions and labels we have decoded so far.
              </p>
              <div className={styles.suggestions}>
                {ideas.map((idea) => (
                  <Link href={`/search?q=${encodeURIComponent(idea)}`} key={idea}>
                    {idea}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {!query ? (
            <div className={styles.empty}>
              <span aria-hidden="true">⌕</span>
              <h2>What are you looking for?</h2>
              <p>
                Start with a person, an event or a label. These are what the
                archive is busiest with right now.
              </p>
              <div className={styles.suggestions}>
                {ideas.map((idea) => (
                  <Link href={`/search?q=${encodeURIComponent(idea)}`} key={idea}>
                    {idea}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {/*
            A partial answer has to say it is partial. Results a reader was not
            told were partial look like the site misunderstood the question —
            and this is the case where it half did: "alia bhatt airport look"
            used to return nothing at all, because every word had to match.
          */}
          {outcome.partial ? (
            <p className={styles.partial} role="status">
              Nothing matches all {outcome.words} words of “{query}”. Showing
              the closest {results.length === 1 ? "match" : "matches"}, on{" "}
              {outcome.matched === 1 ? "one word" : `${outcome.matched} of those words`}.
            </p>
          ) : null}

          {GROUPS.map(({ kind, label }) => {
            const group = results.filter((entry) => entry.kind === kind);
            if (group.length === 0) return null;
            return (
              <section className={styles.section} key={kind}>
                <div className={styles.heading}>
                  <h2>{label}</h2>
                  <span>{group.length}</span>
                </div>
                <div className={styles.grid}>
                  {group.map((entry) => (
                    <Hit entry={entry} key={entry.href} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
      <Footer />
      <MobileTabs active="search" />
      <ScrollEffects />
    </>
  );
}

function Hit({ entry }: { entry: SearchEntry }) {
  return (
    <Link className={styles.hit} href={entry.href}>
      <div className={styles.hitImage}>
        {entry.image ? (
          <Image src={entry.image} alt="" fill sizes="56px" />
        ) : null}
      </div>
      <div>
        <b>{entry.title}</b>
        <small>{entry.subtitle}</small>
      </div>
    </Link>
  );
}
