import Link from "next/link";
import { celebritySlug } from "@/lib/slugs";
import styles from "@/app/admin/panel.module.css";
import { getCelebrities, getOutfits } from "@/lib/db/content";
import { Pagination } from "@/components/admin/Pagination";
import { paginate, readPerPage } from "@/lib/pagination";

export default async function AdminCelebrities({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; per?: string }>;
}) {
  const query = await searchParams;
  const allCelebrities = await getCelebrities();
  const paged = paginate(allCelebrities, query.page, readPerPage(query.per));
  const celebrities = paged.rows;
  const outfits = await getOutfits();

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
                <th>Published looks</th>
                <th>Decoded</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {celebrities.map((celebrity) => {
                const decoded = outfits.filter(
                  (outfit) => outfit.celebrity === celebrity.name,
                ).length;
                return (
                  <tr key={celebrity.name}>
                    <td>{celebrity.name}</td>
                    <td className={`${styles.num} ${styles.muted}`}>
                      {celebritySlug(celebrity)}
                    </td>
                    <td className={styles.num}>{celebrity.looks}</td>
                    <td className={styles.num}>
                      {decoded === 0 ? (
                        <span className={styles.chip}>none yet</span>
                      ) : (
                        decoded
                      )}
                    </td>
                    <td className={styles.num}>
                      <span className={styles.rowActions}>
                        <Link href={`/admin/celebrities/${celebrity.id}`}>Edit</Link>
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
