import Link from "next/link";
import styles from "@/app/admin/panel.module.css";
import { SearchCell } from "@/components/admin/SearchCell";
import { getBrandViews } from "@/lib/db/content";
import { hubSearchStatus, wordCount } from "@/lib/indexing";
import { nameSlug } from "@/lib/slugs";

/**
 * Every label the archive names. The list and the counts come from the
 * outfits; a record — created when a look first names the label — holds the
 * intro and search fields that decide whether its page is indexed.
 */
export default async function AdminBrands() {
  const brands = await getBrandViews();
  const needIntro = brands.filter(
    (brand) => hubSearchStatus({ looks: brand.stats.looks, introWords: wordCount(brand.intro) }).needsIntro,
  ).length;

  return (
    <>
      {needIntro ? (
        <div className={styles.notice}>
          <strong>
            {needIntro} brand {needIntro === 1 ? "page is" : "pages are"} noindex for want of an intro
          </strong>
          <p>A brand page needs 2 looks, or an intro of 100+ words, to be indexed.</p>
        </div>
      ) : null}
      <div className={styles.listTop}>
        <p>{brands.length} labels.</p>
      </div>
      <div className={styles.tableWrap}>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Looks</th>
                <th>Worn · swap</th>
                <th>Search</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) => (
                <tr key={brand.name}>
                  <td>
                    {brand.name}
                    {brand.record ? null : <> <span className={styles.chip}>no record</span></>}
                  </td>
                  <td className={styles.num}>{brand.stats.looks}</td>
                  <td className={`${styles.num} ${styles.muted}`}>
                    {brand.stats.worn} · {brand.stats.swapped}
                  </td>
                  <SearchCell
                    status={hubSearchStatus({ looks: brand.stats.looks, introWords: wordCount(brand.intro) })}
                    introWords={wordCount(brand.intro)}
                  />
                  <td className={styles.num}>
                    <span className={styles.rowActions}>
                      {brand.record ? <Link href={`/admin/brands/${brand.id}`}>Edit</Link> : null}
                      <Link href={`/brands/${nameSlug(brand.name)}`} target="_blank">
                        View ↗
                      </Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
