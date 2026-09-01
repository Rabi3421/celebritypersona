import Link from "next/link";
import { celebritySlug } from "@/lib/slugs";
import styles from "@/app/admin/panel.module.css";
import { getCelebrityViews } from "@/lib/db/content";
import { ListFilters } from "@/components/admin/ListFilters";
import { Pagination } from "@/components/admin/Pagination";
import { paginate, readPerPage } from "@/lib/pagination";
import { anyFilter, carry, matchesQuery } from "@/lib/admin-filters";
import type { CelebrityView } from "@/lib/archive";

type Query = { page?: string; per?: string; q?: string; state?: string; sort?: string };

const FILTER_KEYS = ["q", "state", "sort"];

const STATES = [
  { value: "all", label: "Everyone" },
  { value: "no-record", label: "In outfits, no record" },
  { value: "no-looks", label: "Record, no looks" },
  { value: "no-bio", label: "No bio written" },
  { value: "trending", label: "Trending now" },
];

const SORTS = [
  { value: "looks", label: "Most decoded" },
  { value: "az", label: "A–Z" },
  { value: "recent", label: "Most recently decoded" },
  { value: "saving", label: "Biggest average saving" },
];

function inState(celebrity: CelebrityView, state: string | undefined) {
  switch (state) {
    case "no-record":
      return !celebrity.record;
    case "no-looks":
      return celebrity.record && celebrity.stats.looks === 0;
    case "no-bio":
      return !celebrity.bio?.length;
    case "trending":
      return celebrity.trending;
    default:
      return true;
  }
}

export default async function AdminCelebrities({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const [all, query] = await Promise.all([getCelebrityViews(), searchParams]);

  const filtered = all.filter(
    (celebrity) =>
      matchesQuery(query.q, celebrity.name, celebritySlug(celebrity)) &&
      inState(celebrity, query.state),
  );

  const sorted = [...filtered].sort((a, b) => {
    switch (query.sort) {
      case "az":
        return a.name.localeCompare(b.name);
      case "recent":
        return (b.stats.lastDecoded ?? "").localeCompare(a.stats.lastDecoded ?? "");
      case "saving":
        return (b.stats.averageSaving ?? -1) - (a.stats.averageSaving ?? -1);
      default:
        return b.stats.looks - a.stats.looks || a.name.localeCompare(b.name);
    }
  });

  const paged = paginate(sorted, query.page, readPerPage(query.per));
  const active = anyFilter(query, FILTER_KEYS);
  const missing = all.filter((celebrity) => !celebrity.record).length;

  return (
    <>
      {missing > 0 ? (
        <div className={styles.notice}>
          <strong>
            {missing} {missing === 1 ? "name has" : "names have"} looks but no record
          </strong>
          <p>
            Their pages work and their numbers are counted, but they have no bio
            and nothing to edit until a record exists.{" "}
            <Link href="/admin/celebrities?state=no-record">Show just those →</Link>
          </p>
        </div>
      ) : null}

      <div className={styles.listTop}>
        <p>
          {active ? `${paged.total} of ${all.length} archives match.` : `${paged.total} archives.`}
        </p>
        <Link className={styles.newButton} href="/admin/celebrities/new">
          New celebrity
        </Link>
      </div>

      <ListFilters
        action="/admin/celebrities"
        active={active}
        fields={[
          { kind: "search", name: "q", label: "Search", value: query.q, placeholder: "Name or slug" },
          { kind: "select", name: "state", label: "State", value: query.state, options: STATES },
          { kind: "select", name: "sort", label: "Sort", value: query.sort, options: SORTS },
        ]}
      />

      {paged.total === 0 ? (
        <div className={styles.empty}>
          <strong>{all.length === 0 ? "No archives yet" : "Nothing matches those filters"}</strong>
          <p>
            {all.length === 0 ? (
              <>
                A record adds a bio and a profile page. The counts behind it come
                from the outfits.{" "}
                <Link href="/admin/celebrities/new">Add the first archive →</Link>
              </>
            ) : (
              <>
                Try a broader search, or <Link href="/admin/celebrities">clear the filters</Link>.
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
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Looks decoded</th>
                  <th>Avg saving</th>
                  <th>Last decoded</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((celebrity) => {
                  const { looks, averageSaving, lastDecoded } = celebrity.stats;
                  return (
                    <tr key={celebritySlug(celebrity)}>
                      <td>
                        {celebrity.name}
                        {celebrity.record ? null : (
                          <> <span className={styles.chip}>no record</span></>
                        )}
                        {celebrity.trending ? (
                          <> <span className={`${styles.chip} ${styles.new}`}>Trending</span></>
                        ) : null}
                      </td>
                      <td className={`${styles.num} ${styles.muted}`}>
                        {celebritySlug(celebrity)}
                      </td>
                      <td className={styles.num}>
                        {looks === 0 ? <span className={styles.chip}>none yet</span> : looks}
                      </td>
                      <td className={`${styles.num} ${styles.save}`}>
                        {averageSaving === null ? "—" : `${averageSaving}%`}
                      </td>
                      <td className={`${styles.num} ${styles.muted}`}>{lastDecoded ?? "—"}</td>
                      <td className={styles.num}>
                        <span className={styles.rowActions}>
                          {celebrity.record ? (
                            <Link href={`/admin/celebrities/${celebrity.id}`}>Edit</Link>
                          ) : (
                            <Link href="/admin/celebrities/new">Add record</Link>
                          )}
                          <Link href={`/celebrities/${celebritySlug(celebrity)}`} target="_blank">
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
      )}

      <Pagination
        paged={paged}
        basePath="/admin/celebrities"
        params={carry(query, FILTER_KEYS)}
        label="archives"
      />
    </>
  );
}
