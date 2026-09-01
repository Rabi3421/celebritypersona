import Link from "next/link";
import { celebritySlug } from "@/lib/slugs";
import styles from "@/app/admin/panel.module.css";
import { getCelebrityViews } from "@/lib/db/content";
import { Pagination } from "@/components/admin/Pagination";
import { paginate, readPerPage } from "@/lib/pagination";

export default async function AdminCelebrities({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; per?: string }>;
}) {
  const query = await searchParams;
  const allCelebrities = await getCelebrityViews();
  const paged = paginate(allCelebrities, query.page, readPerPage(query.per));
  const celebrities = paged.rows;

  return (
    <>
      <div className={styles.listTop}>
        <p>{`${paged.total} archives.`}</p>
        <Link className={styles.newButton} href="/admin/celebrities/new">
          New celebrity
        </Link>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Looks decoded</th>
                <th>Avg saving</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {celebrities.map((celebrity) => {
                const { looks, averageSaving } = celebrity.stats;
                return (
                  <tr key={celebrity.name}>
                    <td>
                      {celebrity.name}
                      {celebrity.record ? null : (
                        <span className={styles.chip}>no record</span>
                      )}
                    </td>
                    <td className={`${styles.num} ${styles.muted}`}>
                      {celebritySlug(celebrity)}
                    </td>
                    <td className={styles.num}>
                      {looks === 0 ? (
                        <span className={styles.chip}>none yet</span>
                      ) : (
                        looks
                      )}
                    </td>
                    <td className={`${styles.num} ${styles.save}`}>
                      {averageSaving === null ? "—" : `${averageSaving}%`}
                    </td>
                    <td className={styles.num}>
                      <span className={styles.rowActions}>
                        {celebrity.record ? (
                          <Link href={`/admin/celebrities/${celebrity.id}`}>Edit</Link>
                        ) : (
                          <Link href="/admin/celebrities/new">Add record</Link>
                        )}
                        <Link
                          href={`/celebrities/${celebritySlug(celebrity)}`}
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

      <Pagination paged={paged} basePath="/admin/celebrities" label="archives" />
      </div>
    </>
  );
}
