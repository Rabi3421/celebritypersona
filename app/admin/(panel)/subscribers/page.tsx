import Link from "next/link";
import { StatusRowActions } from "@/components/admin/StatusRowActions";
import { ListFilters } from "@/components/admin/ListFilters";
import { Pagination } from "@/components/admin/Pagination";
import { removeSubscriber, updateSubscriberStatus } from "../requests/actions";
import { paginate, readPerPage } from "@/lib/pagination";
import { allOption, anyFilter, carry, matchesQuery, matchesValue } from "@/lib/admin-filters";
import { getSubscribers } from "@/lib/db/content";
import { SUBSCRIBER_STATUSES, type SubscriberStatus } from "@/lib/types";
import styles from "@/app/admin/panel.module.css";

type Query = { page?: string; per?: string; q?: string; status?: string };

const FILTER_KEYS = ["q", "status"];

const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const asDay = (value: string) => {
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : day.format(parsed);
};

/** ra••••@gmail.com — enough to recognise an address across a room, not
 *  enough to read one off a shoulder. */
const masked = (email: string) => {
  const at = email?.indexOf("@") ?? -1;
  if (at < 3) return email;
  return `${email.slice(0, 2)}••••${email.slice(at)}`;
};

export default async function AdminSubscribers({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const [all, query] = await Promise.all([getSubscribers(), searchParams]);

  const filtered = all.filter(
    (subscriber) =>
      matchesQuery(query.q, subscriber.email ?? subscriber.number ?? "") &&
      matchesValue(query.status, subscriber.status),
  );
  const paged = paginate(filtered, query.page, readPerPage(query.per));
  const active = anyFilter(query, FILTER_KEYS);
  const count = (status: SubscriberStatus) =>
    all.filter((subscriber) => subscriber.status === status).length;
  const activeCount = count("Active");

  return (
    <>
      <div className={styles.notice}>
        <strong>Nobody is mailed until they confirm</strong>
        <p>
          An address that has not clicked the link in its confirmation mail sits
          at Pending and is never written to. Bounced and Complained are
          endings, not pauses: those addresses are closed for good, because
          writing to them again is what destroys a sending reputation. Announce
          a look from <Link href="/admin/broadcasts">Broadcasts</Link>.
        </p>
      </div>

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span>Active</span>
          <b className={activeCount ? styles.ok : undefined}>{activeCount}</b>
          <small>Confirmed, and mailed</small>
        </div>
        <div className={styles.tile}>
          <span>Pending</span>
          <b>{count("Pending")}</b>
          <small>Asked, but have not clicked the link</small>
        </div>
        <div className={styles.tile}>
          <span>Unsubscribed</span>
          <b>{count("Unsubscribed")}</b>
          <small>Kept, so they cannot be re-added by accident</small>
        </div>
        <div className={styles.tile}>
          <span>Closed</span>
          <b>{count("Bounced") + count("Complained")}</b>
          <small>Bounced or marked us as spam</small>
        </div>
      </div>

      <div className={styles.listTop}>
        <p>
          {active
            ? `${paged.total} of ${all.length} addresses match.`
            : `${paged.total} ${all.length === 1 ? "address" : "addresses"}, newest first.`}
        </p>
        <Link className={styles.newButton} href="/#updates" target="_blank">
          See the public form ↗
        </Link>
      </div>

      {all.length > 0 ? (
        <ListFilters
          action="/admin/subscribers"
          active={active}
          fields={[
            { kind: "search", name: "q", label: "Search", value: query.q, placeholder: "Address" },
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
                The homepage asks for an email address. Addresses land here as
                Pending and turn Active when the reader clicks the link in the
                confirmation mail.{" "}
                <Link href="/#updates" target="_blank">
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
                  <th>Address</th>
                  <th>Joined</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((subscriber) => (
                  <tr key={subscriber.id}>
                    <td className={styles.num}>
                      {subscriber.email ? (
                        <a href={`mailto:${subscriber.email}`}>{masked(subscriber.email)}</a>
                      ) : (
                        <span title="Collected before the list moved to email">
                          {subscriber.number ?? "—"}{" "}
                          <small className={styles.muted}>WhatsApp, never mailed</small>
                        </span>
                      )}
                      {subscriber.stoppedReason ? (
                        <small className={styles.muted}> · {subscriber.stoppedReason}</small>
                      ) : null}
                    </td>
                    <td className={`${styles.num} ${styles.muted}`}>
                      {asDay(subscriber.joinedAt)}
                    </td>
                    <td>
                      <StatusRowActions
                        id={subscriber.id}
                        status={subscriber.status}
                        statuses={SUBSCRIBER_STATUSES}
                        label={subscriber.email ?? subscriber.number ?? subscriber.id}
                        confirm="Delete this address? Unsubscribing keeps it on the list so it cannot be re-added by accident; deleting does not."
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
        label="addresses"
      />
    </>
  );
}
