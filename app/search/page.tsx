import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { buildSearchIndex, searchEntries, type SearchEntry, type SearchKind } from "@/lib/search";
import { celebrityTiles, occasionTiles } from "@/lib/archive";
import { getCelebrities, getOccasions, getOutfits, getTrendingSearches } from "@/lib/db/content";
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
  const [{ q }, outfits, celebrities, occasions, trending] = await Promise.all([
    searchParams,
    getOutfits(),
    getCelebrities(),
    getOccasions(),
    getTrendingSearches(),
  ]);

  const query = (q ?? "").trim().slice(0, 120);
  const index = buildSearchIndex({ outfits, celebrities, occasions });
  const results = query ? searchEntries(index, query, 60) : [];

  // Something to click when there is nothing to show: what the site is busiest
  // with, taken from the archive rather than a list of guesses.
  const ideas = [
    ...trending.slice(0, 4).map((search) => search.term),
    ...celebrityTiles(outfits, 3).map((tile) => tile.name),
    ...occasionTiles(outfits, 3).map((tile) => tile.name),
  ].filter((value, position, all) => all.indexOf(value) === position);

  return (
    <>
      <Nav />
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
                We may not have decoded it yet. Every word has to match, so a
                shorter search often finds more.
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
