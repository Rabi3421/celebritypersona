import Link from "next/link";
import { occasionSlug } from "@/lib/slugs";
import styles from "@/app/admin/panel.module.css";
import { getOccasionViews } from "@/lib/db/content";
import { Pagination } from "@/components/admin/Pagination";
import { paginate, readPerPage } from "@/lib/pagination";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default async function AdminOccasions({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; per?: string }>;
}) {
  const query = await searchParams;
  const allOccasions = await getOccasionViews();
  const paged = paginate(allOccasions, query.page, readPerPage(query.per));
  const occasions = paged.rows;

  return (
    <>
      <div className={styles.listTop}>
        <p>{`${paged.total} occasions.`}</p>
        <Link className={styles.newButton} href="/admin/occasions/new">
          New occasion
        </Link>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Occasion</th>
                <th>Group</th>
                <th>Peak</th>
                <th>Looks decoded</th>
                <th>Swaps from</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {occasions.map((occasion) => {
                const { looks, swapFrom } = occasion.stats;
                return (
                  <tr key={occasion.id}>
                    <td>
                      {occasion.name}
                      {occasion.record ? null : (
                        <span className={styles.chip}>no record</span>
                      )}
                    </td>
                    <td>
                      <span className={styles.chip}>{occasion.group}</span>
                    </td>
                    <td className={styles.muted}>{occasion.peak}</td>
                    <td className={styles.num}>
                      {looks === 0 ? (
                        <span className={styles.chip}>none yet</span>
                      ) : (
                        looks
                      )}
                    </td>
                    <td className={`${styles.num} ${styles.save}`}>
                      {swapFrom === null ? "—" : inr.format(swapFrom)}
                    </td>
                    <td className={styles.num}>
                      <span className={styles.rowActions}>
                        {occasion.record ? (
                          <Link href={`/admin/occasions/${occasion.id}`}>Edit</Link>
                        ) : (
                          <Link href="/admin/occasions/new">Add record</Link>
                        )}
                        <Link
                          href={`/occasions/${occasionSlug(occasion)}`}
                          target="_blank"
                        >
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

      <Pagination paged={paged} basePath="/admin/occasions" label="occasions" />
      </div>
    </>
  );
}
