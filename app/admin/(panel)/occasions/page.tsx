import Link from "next/link";
import { occasionSlug } from "@/lib/slugs";
import styles from "@/app/admin/panel.module.css";
import { getOccasionViews } from "@/lib/db/content";
import { ListFilters } from "@/components/admin/ListFilters";
import { Pagination } from "@/components/admin/Pagination";
import { paginate, readPerPage } from "@/lib/pagination";
import { allOption, anyFilter, carry, matchesQuery, matchesValue } from "@/lib/admin-filters";
import type { OccasionView } from "@/lib/archive";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

type Query = { page?: string; per?: string; q?: string; group?: string; state?: string; sort?: string };

const FILTER_KEYS = ["q", "group", "state", "sort"];

const STATES = [
  { value: "all", label: "Any state" },
  { value: "no-record", label: "In outfits, no record" },
  { value: "no-looks", label: "Record, no looks" },
  { value: "no-date", label: "No next date set" },
  { value: "upcoming", label: "Coming up" },
];

const SORTS = [
  { value: "looks", label: "Most decoded" },
  { value: "az", label: "A–Z" },
  { value: "soonest", label: "Soonest first" },
];

function inState(occasion: OccasionView, state: string | undefined) {
  switch (state) {
    case "no-record":
      return !occasion.record;
    case "no-looks":
      return occasion.record && occasion.stats.looks === 0;
    case "no-date":
      return !occasion.nextDate;
    case "upcoming":
      return occasion.daysAway !== null && occasion.daysAway >= 0;
    default:
      return true;
  }
}

export default async function AdminOccasions({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const [all, query] = await Promise.all([getOccasionViews(), searchParams]);

  const filtered = all.filter(
    (occasion) =>
      matchesQuery(query.q, occasion.name, occasionSlug(occasion), occasion.peak) &&
      matchesValue(query.group, occasion.group) &&
      inState(occasion, query.state),
  );

  const sorted = [...filtered].sort((a, b) => {
    switch (query.sort) {
      case "az":
        return a.name.localeCompare(b.name);
      case "soonest":
        // Undated occasions sink rather than sorting as if they were today.
        return (a.daysAway ?? Number.POSITIVE_INFINITY) - (b.daysAway ?? Number.POSITIVE_INFINITY);
      default:
        return b.stats.looks - a.stats.looks || a.name.localeCompare(b.name);
    }
  });

  const paged = paginate(sorted, query.page, readPerPage(query.per));
  const active = anyFilter(query, FILTER_KEYS);
  const missing = all.filter((occasion) => !occasion.record).length;

  return (
    <>
      {missing > 0 ? (
        <div className={styles.notice}>
          <strong>
            {missing} {missing === 1 ? "occasion is" : "occasions are"} used by outfits with no record
          </strong>
          <p>
            They are filed under Everyday and have no description or palette
            until a record exists.{" "}
            <Link href="/admin/occasions?state=no-record">Show just those →</Link>
          </p>
        </div>
      ) : null}

      <div className={styles.listTop}>
        <p>
          {active ? `${paged.total} of ${all.length} occasions match.` : `${paged.total} occasions.`}
        </p>
        <Link className={styles.newButton} href="/admin/occasions/new">
          New occasion
        </Link>
      </div>

      <ListFilters
        action="/admin/occasions"
        active={active}
        fields={[
          { kind: "search", name: "q", label: "Search", value: query.q, placeholder: "Name, slug or peak" },
          {
            kind: "select",
            name: "group",
            label: "Group",
            value: query.group,
            options: allOption("Any group", ["Wedding", "Festival", "Everyday"]),
          },
          { kind: "select", name: "state", label: "State", value: query.state, options: STATES },
          { kind: "select", name: "sort", label: "Sort", value: query.sort, options: SORTS },
        ]}
      />

      {paged.total === 0 ? (
        <div className={styles.empty}>
          <strong>{all.length === 0 ? "No occasions yet" : "Nothing matches those filters"}</strong>
          <p>
            {all.length === 0 ? (
              <>
                An occasion record adds the guide copy, the palette and the
                countdown. Its counts come from the outfits filed under it.{" "}
                <Link href="/admin/occasions/new">Add the first occasion →</Link>
              </>
            ) : (
              <>
                Try a broader search, or <Link href="/admin/occasions">clear the filters</Link>.
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
                  <th>Occasion</th>
                  <th>Group</th>
                  <th>Next date</th>
                  <th>Looks decoded</th>
                  <th>Swaps from</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((occasion) => {
                  const { looks, swapFrom } = occasion.stats;
                  return (
                    <tr key={occasionSlug(occasion)}>
                      <td>
                        {occasion.name}
                        {occasion.record ? null : (
                          <> <span className={styles.chip}>no record</span></>
                        )}
                      </td>
                      <td>
                        <span className={styles.chip}>{occasion.group}</span>
                      </td>
                      <td className={`${styles.num} ${styles.muted}`}>
                        {occasion.nextDate ? (
                          <>
                            {occasion.nextDate}
                            {occasion.daysAway !== null && occasion.daysAway >= 0 ? (
                              <> <span className={styles.chip}>in {occasion.daysAway}d</span></>
                            ) : (
                              <> <span className={styles.chip}>passed</span></>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={styles.num}>
                        {looks === 0 ? <span className={styles.chip}>none yet</span> : looks}
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
                          <Link href={`/occasions/${occasionSlug(occasion)}`} target="_blank">
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
        basePath="/admin/occasions"
        params={carry(query, FILTER_KEYS)}
        label="occasions"
      />
    </>
  );
}
