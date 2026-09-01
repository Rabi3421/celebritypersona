import Link from "next/link";
import { StatusRowActions } from "@/components/admin/StatusRowActions";
import { ListFilters } from "@/components/admin/ListFilters";
import { Pagination } from "@/components/admin/Pagination";
import { removeRequest, updateRequestStatus } from "./actions";
import { paginate, readPerPage } from "@/lib/pagination";
import { allOption, anyFilter, carry, matchesQuery, matchesValue } from "@/lib/admin-filters";
import { getCelebrityViews, getCelebrityRequests } from "@/lib/db/content";
import { nameSlug } from "@/lib/slugs";
import { REQUEST_STATUSES } from "@/lib/types";
import styles from "@/app/admin/panel.module.css";

type Query = { page?: string; per?: string; q?: string; status?: string };

const FILTER_KEYS = ["q", "status"];

const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const asDay = (value: string) => {
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : day.format(parsed);
};

/**
 * Who readers want decoded next, ranked by how many have asked. The public
 * form promises the most-asked-for names get done first; this is the list that
 * makes that true.
 */
export default async function AdminRequests({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const [all, celebrities, query] = await Promise.all([
    getCelebrityRequests(),
    getCelebrityViews(),
    searchParams,
  ]);

  // A request for someone already in the archive is worth spotting: it usually
  // means she is hard to find rather than missing.
  const known = new Set(celebrities.map((celebrity) => nameSlug(celebrity.name)));

  const filtered = all.filter(
    (request) =>
      matchesQuery(query.q, request.name) && matchesValue(query.status, request.status),
  );
  const paged = paginate(filtered, query.page, readPerPage(query.per));
  const active = anyFilter(query, FILTER_KEYS);
  const waiting = all.filter((request) => request.status === "New").length;

  return (
    <>
      {waiting > 0 ? (
        <div className={styles.notice}>
          <strong>
            {waiting} new {waiting === 1 ? "request" : "requests"}
          </strong>
          <p>
            Ranked by how many people asked. Marking one Queued or Decoded keeps
            the list honest about what is actually coming.{" "}
            <Link href="/admin/requests?status=New">Show just those →</Link>
          </p>
        </div>
      ) : null}

      <div className={styles.listTop}>
        <p>
          {active
            ? `${paged.total} of ${all.length} requests match.`
            : `${paged.total} ${all.length === 1 ? "request" : "requests"}, most-wanted first.`}
        </p>
        <Link className={styles.newButton} href="/celebrities" target="_blank">
          See the public form ↗
        </Link>
      </div>

      {all.length > 0 ? (
        <ListFilters
          action="/admin/requests"
          active={active}
          fields={[
            { kind: "search", name: "q", label: "Search", value: query.q, placeholder: "Name" },
            {
              kind: "select",
              name: "status",
              label: "Status",
              value: query.status,
              options: allOption("Any status", [...REQUEST_STATUSES]),
            },
          ]}
        />
      ) : null}

      {paged.total === 0 ? (
        <div className={styles.empty}>
          <strong>{all.length === 0 ? "Nobody has asked yet" : "Nothing matches those filters"}</strong>
          <p>
            {all.length === 0 ? (
              <>
                The celebrities page asks readers who to decode next. Names
                land here, and asking twice adds a vote rather than a duplicate.{" "}
                <Link href="/celebrities" target="_blank">
                  See the public form ↗
                </Link>
              </>
            ) : (
              <>
                Try a broader search, or <Link href="/admin/requests">clear the filters</Link>.
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
                  <th>Asked</th>
                  <th>First asked</th>
                  <th>Last asked</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((request) => (
                  <tr key={request.id}>
                    <td>
                      {request.name}
                      {known.has(nameSlug(request.name)) ? (
                        <> <span className={styles.chip}>already an archive</span></>
                      ) : null}
                    </td>
                    <td className={styles.num}>
                      <b>{request.votes}</b>
                    </td>
                    <td className={`${styles.num} ${styles.muted}`}>
                      {asDay(request.firstAskedAt)}
                    </td>
                    <td className={`${styles.num} ${styles.muted}`}>
                      {asDay(request.lastAskedAt)}
                    </td>
                    <td>
                      <StatusRowActions
                        id={request.id}
                        status={request.status}
                        statuses={REQUEST_STATUSES}
                        label={`request for ${request.name}`}
                        confirm={`Delete the request for ${request.name}? Its ${request.votes} vote${request.votes === 1 ? "" : "s"} go with it.`}
                        onStatus={updateRequestStatus}
                        onDelete={removeRequest}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination
        paged={paged}
        basePath="/admin/requests"
        params={carry(query, FILTER_KEYS)}
        label="requests"
      />
    </>
  );
}
