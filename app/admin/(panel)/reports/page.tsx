import Link from "next/link";
import { ReportRowActions } from "@/components/admin/ReportRowActions";
import { ListFilters } from "@/components/admin/ListFilters";
import { Pagination } from "@/components/admin/Pagination";
import { paginate, readPerPage } from "@/lib/pagination";
import { allOption, anyFilter, carry, matchesQuery, matchesValue } from "@/lib/admin-filters";
import styles from "@/app/admin/panel.module.css";
import { getPriceReports } from "@/lib/db/content";
import { PRICE_REPORT_ISSUES, PRICE_REPORT_STATUSES } from "@/lib/types";

type Query = { page?: string; per?: string; q?: string; status?: string; issue?: string };

const FILTER_KEYS = ["q", "status", "issue"];

const received = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Older rows carry a plain YYYY-MM-DD, newer ones a full timestamp. */
function whenLabel(value: string) {
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : received.format(parsed);
}

export default async function AdminReports({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const [all, query] = await Promise.all([getPriceReports(), searchParams]);

  const filtered = all.filter(
    (report) =>
      matchesQuery(query.q, report.outfitSlug, report.detail, report.piece, report.reporterEmail) &&
      matchesValue(query.status, report.status) &&
      matchesValue(query.issue, report.issue),
  );

  const paged = paginate(filtered, query.page, readPerPage(query.per));
  const active = anyFilter(query, FILTER_KEYS);
  const unread = all.filter((report) => report.status === "New").length;

  return (
    <>
      {unread > 0 ? (
        <div className={styles.notice}>
          <strong>
            {unread} new {unread === 1 ? "report" : "reports"} waiting
          </strong>
          <p>
            Readers see the status of nothing, so the only promise here is the
            one on the public page: we check reports against the shop, usually
            the same day.{" "}
            <Link href="/admin/reports?status=New">Show just those →</Link>
          </p>
        </div>
      ) : null}

      <div className={styles.listTop}>
        <p>
          {active
            ? `${paged.total} of ${all.length} reports match.`
            : `${paged.total} ${all.length === 1 ? "report" : "reports"}, newest first.`}
        </p>
        <Link className={styles.newButton} href="/report-a-price" target="_blank">
          See the public form ↗
        </Link>
      </div>

      {all.length > 0 ? (
        <ListFilters
          action="/admin/reports"
          active={active}
          fields={[
            {
              kind: "search",
              name: "q",
              label: "Search",
              value: query.q,
              placeholder: "Look, piece, detail or reporter",
            },
            {
              kind: "select",
              name: "status",
              label: "Status",
              value: query.status,
              options: allOption("Any status", [...PRICE_REPORT_STATUSES]),
            },
            {
              kind: "select",
              name: "issue",
              label: "Issue",
              value: query.issue,
              options: allOption("Any issue", [...PRICE_REPORT_ISSUES]),
            },
          ]}
        />
      ) : null}

      {paged.total === 0 ? (
        <div className={styles.empty}>
          <strong>{all.length === 0 ? "Nothing here yet" : "Nothing matches those filters"}</strong>
          <p>
            {all.length === 0 ? (
              <>
                Corrections and swap suggestions from the public form land here
                the moment they are sent. Every outfit page links to it, and a
                look with no swap yet asks readers directly.{" "}
                <Link href="/report-a-price" target="_blank">
                  See the public form ↗
                </Link>
              </>
            ) : (
              <>
                Try a broader search, or <Link href="/admin/reports">clear the filters</Link>.
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
                  <th>Received</th>
                  <th>Issue</th>
                  <th>What they said</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((report) => (
                  <tr key={report.id}>
                    <td className={`${styles.num} ${styles.muted}`}>
                      {whenLabel(report.receivedAt)}
                    </td>
                    <td>
                      <span className={styles.chip}>{report.issue}</span>
                    </td>
                    <td>
                      <p className={styles.reportBody}>{report.detail}</p>
                      <p className={styles.reportMeta}>
                        {report.outfitSlug ? (
                          <Link href={`/outfits/${report.outfitSlug}`} target="_blank">
                            {report.outfitSlug} ↗
                          </Link>
                        ) : (
                          <span>no look named</span>
                        )}
                        {report.piece ? <span>piece: {report.piece}</span> : null}
                        {report.sourceUrl ? (
                          <a href={report.sourceUrl} target="_blank" rel="noreferrer noopener nofollow">
                            source ↗
                          </a>
                        ) : null}
                        {report.reporterEmail ? (
                          <a href={`mailto:${report.reporterEmail}`}>{report.reporterEmail}</a>
                        ) : (
                          <span>no reply wanted</span>
                        )}
                        {report.note ? <span>note: {report.note}</span> : null}
                      </p>
                    </td>
                    <td>
                      <ReportRowActions report={report} />
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
        basePath="/admin/reports"
        params={carry(query, FILTER_KEYS)}
        label="reports"
      />
    </>
  );
}
