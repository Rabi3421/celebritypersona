import Link from "next/link";
import {
  getCelebrityRequests,
  getCelebrityViews,
  getOccasionViews,
  getOutfits,
  getPriceReports,
  getTrendingSearches,
} from "@/lib/db/content";
import { archiveHealth } from "@/lib/admin-health";
import { archiveTotals, budgetTiers, daysSince } from "@/lib/archive";
import { getDb } from "@/lib/mongodb";
import { outfitSlug } from "@/lib/slugs";
import { grievanceOfficer, legalEntity, pending } from "@/lib/site-config";
import { pricing } from "@/lib/types";
import styles from "@/app/admin/panel.module.css";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

async function databaseStatus() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return { label: "Connected", ok: true };
  } catch {
    return { label: "Unreachable", ok: false };
  }
}

const ago = (date: string | null) => {
  if (!date) return "never";
  const days = daysSince(date, new Date());
  if (!Number.isFinite(days)) return date;
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
};

export default async function Overview() {
  const [status, outfits, celebrities, occasions, reports, requests, searches] =
    await Promise.all([
      databaseStatus(),
      getOutfits(),
      getCelebrityViews(),
      getOccasionViews(),
      getPriceReports(),
      getCelebrityRequests(),
      getTrendingSearches(),
    ]);

  // The same figures the public pages compute, so the panel and the site can
  // never disagree about what the archive holds.
  const totals = archiveTotals(outfits);
  const health = archiveHealth({ outfits, celebrities, occasions, reports, requests });
  const attention = health.filter((check) => !check.ok);
  const tiers = budgetTiers(outfits);

  const unfilledLegal = [
    legalEntity.name,
    legalEntity.address,
    legalEntity.cin,
    grievanceOfficer.name,
  ].filter(pending).length;

  return (
    <>
      {status.ok ? null : (
        <div className={styles.notice}>
          <strong>The database is unreachable</strong>
          <p>
            Nothing on this screen is current, and the public site is serving
            whatever it last built. Check MONGODB_URI and that this machine&apos;s
            IP is on the Atlas access list.
          </p>
        </div>
      )}

      {unfilledLegal > 0 ? (
        <div className={styles.notice}>
          <strong>
            {unfilledLegal} legal detail{unfilledLegal === 1 ? "" : "s"} still unfilled
          </strong>
          <p>
            The registered name, address and Grievance Officer are required on
            the public policy pages by the IT Rules, 2021, and currently render
            as amber placeholders. Fill them in{" "}
            <Link href="/admin/settings">Settings</Link>.
          </p>
        </div>
      ) : null}

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span>Database</span>
          <b className={status.ok ? styles.ok : styles.bad}>{status.label}</b>
          <small>MongoDB Atlas</small>
        </div>
        <div className={styles.tile}>
          <span>Outfits</span>
          <b>{totals.looks}</b>
          <small>{totals.pieces} pieces identified</small>
        </div>
        <div className={styles.tile}>
          <span>Buyable end to end</span>
          <b className={totals.buyable > 0 ? styles.ok : undefined}>{totals.buyable}</b>
          <small>
            {totals.cheapestCompleteLook === null
              ? "No complete look yet"
              : `From ${inr.format(totals.cheapestCompleteLook)}`}
          </small>
        </div>
        <div className={styles.tile}>
          <span>Needs attention</span>
          <b className={attention.length ? styles.warn : styles.ok}>{attention.length}</b>
          <small>{attention.length ? "Checks below" : "Everything is clean"}</small>
        </div>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Archive health</h2>
          <span>What the public site is missing</span>
        </div>
        <div className={styles.health}>
          {health.map((check) => (
            <div
              className={`${styles.healthRow} ${check.ok ? "" : styles.attention}`}
              key={check.key}
            >
              <i aria-hidden="true" />
              <div>
                <strong>
                  {check.label}
                  {check.ok ? null : <> — {check.count}</>}
                </strong>
                <small>{check.detail}</small>
              </div>
              {check.ok ? <span className={styles.chip}>clear</span> : <Link href={check.href}>Fix →</Link>}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>What the site is serving</h2>
          <Link href="/" target="_blank">
            View the homepage ↗
          </Link>
        </div>
        <div className={styles.rows}>
          <div className={styles.row}>
            <strong>Budget tiers</strong>
            <span>
              {tiers.length
                ? tiers.map((tier) => `${inr.format(tier.cap)} · ${tier.looks} looks`).join("   ")
                : "No complete look to build a tier from yet"}
            </span>
            <span className={`${styles.status} ${tiers.length ? styles.good : styles.missing}`}>
              {tiers.length ? "derived" : "empty"}
            </span>
          </div>
          <div className={styles.row}>
            <strong>Average saving</strong>
            <span>
              {totals.averageSavingPct === null
                ? "No look priced on both sides yet"
                : `${totals.averageSavingPct}% across ${totals.looks} looks`}
            </span>
            <span
              className={`${styles.status} ${
                totals.averageSavingPct === null ? styles.missing : styles.good
              }`}
            >
              {totals.averageSavingPct === null ? "empty" : "derived"}
            </span>
          </div>
          <div className={styles.row}>
            <strong>Coverage</strong>
            <span>
              {totals.celebrities} celebrities · {totals.occasions} occasions ·{" "}
              {totals.brands} swap retailers
            </span>
            <span className={`${styles.status} ${styles.good}`}>derived</span>
          </div>
          <div className={styles.row}>
            <strong>Trending leaderboard</strong>
            <span>
              {searches.length
                ? `${searches.length} rows, hand-set until on-site search is recorded`
                : "No rows — the public leaderboard is empty"}
            </span>
            <span className={`${styles.status} ${searches.length ? "" : styles.missing}`}>
              {searches.length ? "manual" : "empty"}
            </span>
          </div>
          <div className={styles.row}>
            <strong>Last decoded</strong>
            <span>
              {totals.lastDecoded ? `${totals.lastDecoded} · ${ago(totals.lastDecoded)}` : "never"}
            </span>
            <span className={`${styles.status} ${totals.lastDecoded ? styles.good : styles.missing}`}>
              {totals.lastDecoded ? "live" : "empty"}
            </span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Recently decoded</h2>
          <Link href="/admin/outfits">All outfits →</Link>
        </div>
        {outfits.length === 0 ? (
          <div className={styles.empty}>
            <strong>Nothing decoded yet</strong>
            <p>
              The public site is built entirely from these looks, so it stays
              empty until the first one is published.{" "}
              <Link href="/admin/outfits/new">Add the first look →</Link>
            </p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Celebrity</th>
                    <th>Event</th>
                    <th>Date</th>
                    <th>As worn</th>
                    <th>Swap</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...outfits]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 6)
                    .map((outfit) => {
                      const money = pricing(outfit);
                      return (
                        <tr key={outfit.id}>
                          <td>{outfit.celebrity}</td>
                          <td className={styles.muted}>{outfit.event}</td>
                          <td className={`${styles.num} ${styles.muted}`}>{outfit.date}</td>
                          <td className={`${styles.num} ${styles.strike}`}>
                            {money.anyPriced ? inr.format(money.wornTotal) : "Unconfirmed"}
                          </td>
                          <td className={`${styles.num} ${styles.save}`}>
                            {money.anySwapped ? inr.format(money.swapTotal) : "None yet"}
                          </td>
                          <td className={styles.num}>
                            <span className={styles.rowActions}>
                              <Link href={`/admin/outfits/${outfit.id}`}>Edit</Link>
                              <Link href={`/outfits/${outfitSlug(outfit)}`} target="_blank">
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
      </section>
    </>
  );
}
