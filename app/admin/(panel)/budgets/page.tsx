import Link from "next/link";
import styles from "@/app/admin/panel.module.css";
import { SearchCell } from "@/components/admin/SearchCell";
import { BUDGET_CAPS, budgetLabel, budgetSlug, looksUnder } from "@/lib/budget";
import { getBudgetPages, getPublishedOutfits } from "@/lib/db/content";
import { hubSearchStatus, wordCount } from "@/lib/indexing";

/** The four fixed budget pages. Which looks each lists is counted; the intro
 *  and search fields are written here. */
export default async function AdminBudgets() {
  const [outfits, pages] = await Promise.all([getPublishedOutfits(), getBudgetPages()]);

  return (
    <div className={styles.tableWrap}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Page</th>
              <th>Looks</th>
              <th>Search</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {BUDGET_CAPS.map((cap) => {
              const record = pages.find((page) => page.cap === cap);
              const looks = looksUnder(outfits, cap).length;
              const words = wordCount(record?.intro);
              return (
                <tr key={cap}>
                  <td>{budgetLabel(cap)}</td>
                  <td className={styles.num}>{looks}</td>
                  <SearchCell status={hubSearchStatus({ looks, introWords: words })} introWords={words} />
                  <td className={styles.num}>
                    <span className={styles.rowActions}>
                      <Link href={`/admin/budgets/${cap}`}>Edit</Link>
                      <Link href={`/budget/${budgetSlug(cap)}`} target="_blank">
                        View ↗
                      </Link>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
