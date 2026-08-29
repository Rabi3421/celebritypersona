import Link from "next/link";
import { trendingBrands } from "@/lib/trending";
import styles from "@/app/admin/panel.module.css";
import { getOutfits, getTrendingSearches } from "@/lib/db/content";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default async function AdminTrending() {
  const trendingSearches = await getTrendingSearches();
  const outfits = await getOutfits();

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
        <div className={styles.sectionHead}>
          <h2>Search leaderboard</h2>
          <Link href="/trending" target="_blank">
            View public page ↗
          </Link>
        </div>
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
                      <Link href={search.href} target="_blank">
                        {search.href} ↗
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
