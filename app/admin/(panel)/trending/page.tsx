import Link from "next/link";
import { trendingBrands } from "@/lib/trending";
import { outfitSlug } from "@/lib/slugs";
import styles from "@/app/admin/panel.module.css";
import { getOutfits, getTrendingSearches } from "@/lib/db/content";
import { ListFilters } from "@/components/admin/ListFilters";
import { allOption, anyFilter, matchesQuery, matchesValue } from "@/lib/admin-filters";
import { getCelebrityViews, getOccasionViews } from "@/lib/db/content";
import { celebritySlug, occasionSlug } from "@/lib/slugs";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

type Query = { q?: string; intent?: string };

const INTENTS = ["Celebrity", "Occasion", "Budget", "Brand", "How to"];

export default async function AdminTrending({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const [allSearches, outfits, celebrities, occasions, query] = await Promise.all([
    getTrendingSearches(),
    getOutfits(),
    getCelebrityViews(),
    getOccasionViews(),
    searchParams,
  ]);

  const trendingSearches = allSearches.filter(
    (search) =>
      matchesQuery(query.q, search.term, search.answer, search.href) &&
      matchesValue(query.intent, search.intent),
  );
  const active = anyFilter(query, ["q", "intent"]);

  // A leaderboard row promising an answer and landing on a 404 is worse than
  // no row, so the table says which destinations the site actually serves.
  const routes = new Set<string>([
    "/", "/outfits", "/celebrities", "/occasions", "/budget", "/trending", "/saved",
    ...celebrities.map((celebrity) => `/celebrities/${celebritySlug(celebrity)}`),
    ...occasions.map((occasion) => `/occasions/${occasionSlug(occasion)}`),
    ...outfits.map((outfit) => `/outfits/${outfitSlug(outfit)}`),
  ]);
  const resolves = (href: string) =>
    !href.startsWith("/") || routes.has(href.split(/[?#]/)[0].replace(/\/$/, "") || "/");

  return (
    <>
      <div className={styles.notice}>
        <strong>These numbers are not measured yet</strong>
        <p>
          The public page states plainly that the leaderboard comes from
          on-site search. Nothing records searches today, so the figures are
          hand-set in the content file. Wire the search box to a collection
          before leaving this claim up.
        </p>
      </div>

      <section>
        <div className={styles.listTop}>
          <p>
            {active
              ? `${trendingSearches.length} of ${allSearches.length} rows match.`
              : `${allSearches.length} leaderboard rows.`}
          </p>
          <Link className={styles.newButton} href="/admin/trending/new">
            New search term
          </Link>
        </div>
        <div className={styles.sectionHead}>
          <h2>Search leaderboard</h2>
          <Link href="/trending" target="_blank">
            View public page ↗
          </Link>
        </div>
        {allSearches.length > 0 ? (
          <ListFilters
            action="/admin/trending"
            active={active}
            fields={[
              { kind: "search", name: "q", label: "Search", value: query.q, placeholder: "Term, answer or destination" },
              { kind: "select", name: "intent", label: "Intent", value: query.intent, options: allOption("Any intent", INTENTS) },
            ]}
          />
        ) : null}
        {trendingSearches.length === 0 ? (
          <div className={styles.empty}>
            <strong>
              {allSearches.length === 0 ? "The leaderboard is empty" : "Nothing matches those filters"}
            </strong>
            <p>
              {allSearches.length === 0 ? (
                <>
                  The public trending page renders its leaderboard from these
                  rows. Everything below it is computed from the archive and
                  still works.{" "}
                  <Link href="/admin/trending/new">Add the first row →</Link>
                </>
              ) : (
                <>
                  Try a broader search, or <Link href="/admin/trending">clear the filters</Link>.
                </>
              )}
            </p>
          </div>
        ) : (
        <div className={styles.tableWrap}>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Term</th>
                  <th>Intent</th>
                  <th>Volume</th>
                  <th>Change</th>
                  <th>Answers to</th>
                </tr>
              </thead>
              <tbody>
                {trendingSearches.map((search, index) => (
                  <tr key={search.term}>
                    <td className={`${styles.num} ${styles.muted}`}>
                      {String(index + 1).padStart(2, "0")}
                    </td>
                    <td>{search.term}</td>
                    <td>
                      <span className={styles.chip}>{search.intent}</span>
                    </td>
                    <td className={styles.num}>
                      {search.volume.toLocaleString("en-IN")}
                    </td>
                    <td className={`${styles.num} ${styles.save}`}>
                      +{search.changePct}%
                    </td>
                    <td className={styles.num}>
                      <span className={styles.rowActions}>
                        <Link href={`/admin/trending/${encodeURIComponent(search.term)}`}>
                          Edit
                        </Link>
                        {resolves(search.href) ? (
                          <Link href={search.href} target="_blank">
                            {search.href} ↗
                          </Link>
                        ) : (
                          <span className={styles.chip}>dead end: {search.href}</span>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Retailers we swap to</h2>
          <span>Computed from the outfit archive</span>
        </div>
        <div className={styles.tableWrap}>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Retailer</th>
                  <th>Swaps</th>
                  <th>Cheapest piece</th>
                </tr>
              </thead>
              <tbody>
                {trendingBrands(outfits).map((brand) => (
                  <tr key={brand.name}>
                    <td>{brand.name}</td>
                    <td className={styles.num}>{brand.swaps}</td>
                    <td className={`${styles.num} ${styles.save}`}>
                      {inr.format(brand.cheapest)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
