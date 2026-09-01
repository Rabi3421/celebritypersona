import Link from "next/link";
import { StatusRowActions } from "@/components/admin/StatusRowActions";
import { ListFilters } from "@/components/admin/ListFilters";
import { Pagination } from "@/components/admin/Pagination";
import { removeSubscriber, updateSubscriberStatus } from "../requests/actions";
import { paginate, readPerPage } from "@/lib/pagination";
import { allOption, anyFilter, carry, matchesQuery, matchesValue } from "@/lib/admin-filters";
import { getSubscribers } from "@/lib/db/content";
import { SUBSCRIBER_STATUSES } from "@/lib/types";
import styles from "@/app/admin/panel.module.css";

type Query = { page?: string; per?: string; q?: string; status?: string };

const FILTER_KEYS = ["q", "status"];

const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const asDay = (value: string) => {
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : day.format(parsed);
};

/** 98••••3210 — enough to recognise a number, not enough to read one off a
 *  shoulder. The full number is one click away in the WhatsApp link. */
const masked = (number: string) =>
  number.length === 10 ? `${number.slice(0, 2)}••••${number.slice(-4)}` : number;

export default async function AdminSubscribers({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const [all, query] = await Promise.all([getSubscribers(), searchParams]);

  const filtered = all.filter(
    (subscriber) =>
      matchesQuery(query.q, subscriber.number) &&
      matchesValue(query.status, subscriber.status),
  );
  const paged = paginate(filtered, query.page, readPerPage(query.per));
  const active = anyFilter(query, FILTER_KEYS);
  const activeCount = all.filter((subscriber) => subscriber.status === "Active").length;

  return (
    <>
      <div className={styles.notice}>
        <strong>Nothing is sent from here</strong>
        <p>
          This is the list the homepage form collects, not a sending tool. The
          numbers are stored and nothing else — no name, no email, no history —
          and the public page promises one word stops the messages, so mark
          anyone who asks as Unsubscribed or delete them outright.
        </p>
      </div>

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span>Active</span>
          <b className={activeCount ? styles.ok : undefined}>{activeCount}</b>
          <small>Want the weekly messages</small>
        </div>
        <div className={styles.tile}>
          <span>Unsubscribed</span>
          <b>{all.length - activeCount}</b>
          <small>Kept so they are not re-added by accident</small>
        </div>
      </div>

      <div className={styles.listTop}>
        <p>
          {active
            ? `${paged.total} of ${all.length} numbers match.`
            : `${paged.total} ${all.length === 1 ? "number" : "numbers"}, newest first.`}
        </p>
        <Link className={styles.newButton} href="/#whatsapp" target="_blank">
          See the public form ↗
        </Link>
      </div>

      {all.length > 0 ? (
        <ListFilters
          action="/admin/subscribers"
          active={active}
          fields={[
            { kind: "search", name: "q", label: "Search", value: query.q, placeholder: "Number" },
            {
              kind: "select",
              name: "status",
              label: "Status",
              value: query.status,
              options: allOption("Any status", [...SUBSCRIBER_STATUSES]),
            },
          ]}
        />
      ) : null}

      {paged.total === 0 ? (
        <div className={styles.empty}>
          <strong>{all.length === 0 ? "Nobody has signed up yet" : "Nothing matches those filters"}</strong>
          <p>
            {all.length === 0 ? (
              <>
                The homepage asks for a WhatsApp number. Numbers land here, and
                signing up twice does not create two rows.{" "}
                <Link href="/#whatsapp" target="_blank">
                  See the public form ↗
                </Link>
              </>
            ) : (
              <>
                Try a broader search, or <Link href="/admin/subscribers">clear the filters</Link>.
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
                  <th>Number</th>
                  <th>Joined</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((subscriber) => (
                  <tr key={subscriber.id}>
                    <td className={styles.num}>
                      <a
                        href={`https://wa.me/91${subscriber.number}`}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {masked(subscriber.number)} ↗
                      </a>
                    </td>
                    <td className={`${styles.num} ${styles.muted}`}>
                      {asDay(subscriber.joinedAt)}
                    </td>
                    <td>
                      <StatusRowActions
                        id={subscriber.id}
                        status={subscriber.status}
                        statuses={SUBSCRIBER_STATUSES}
                        label={`number ending ${subscriber.number.slice(-4)}`}
                        confirm="Delete this number? Unsubscribing keeps it on the list so it cannot be re-added by accident; deleting does not."
                        onStatus={updateSubscriberStatus}
                        onDelete={removeSubscriber}
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
        basePath="/admin/subscribers"
        params={carry(query, FILTER_KEYS)}
        label="numbers"
      />
    </>
  );
}
