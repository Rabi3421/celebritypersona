import Link from "next/link";
import { getAllOutfits, getLinkClicks, getPublishedOutfits } from "@/lib/db/content";
import {
  byLook,
  byRetailer,
  bySide,
  clicksSince,
  earningLooks,
  linkIssues,
  needingSwaps,
  type ClickTally,
} from "@/lib/revenue";
import { outfitSlug } from "@/lib/slugs";
import { plural } from "@/lib/format";
import styles from "@/app/admin/panel.module.css";

/**
 * What the archive earns attention for, and what is stopping it earning money.
 *
 * Clicks only. We do not know a retailer's commission rate, whether a click
 * converted, or whether a conversion was later returned, so there is no rupee
 * figure anywhere on this page. An estimated revenue number would be the same
 * failure as an invented saving on the homepage, in the one place it would be
 * most tempting to invent one.
 */
export const dynamic = "force-dynamic";

function Tally({ title, rows, empty }: { title: string; rows: ClickTally[]; empty: string }) {
  return (
    <div>
      <div className={styles.sectionHead}>
        <h2>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <div className={styles.empty}>
          <p>{empty}</p>
        </div>
      ) : (
        <div className={styles.rows}>
          {rows.slice(0, 10).map((row) => (
            <div className={styles.row} key={row.name}>
              <strong>{row.name}</strong>
              <span>{plural(row.clicks, "click")}</span>
              <span className={row.affiliate > 0 ? styles.ok : styles.muted}>
                {row.affiliate > 0 ? `${row.affiliate} monetised` : "none monetised"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function Revenue() {
  const [clicks, published, all] = await Promise.all([
    getLinkClicks(),
    getPublishedOutfits(),
    getAllOutfits(),
  ]);

  const week = clicksSince(clicks, 7);
  const month = clicksSince(clicks, 30);
  const earning = earningLooks(published);
  const issues = linkIssues(all, outfitSlug);
  const queue = needingSwaps(published);

  return (
    <>
      {earning.length === 0 ? (
        <div className={styles.notice}>
          <strong>Nothing in the archive can earn yet</strong>
          <p>
            A look can earn once one of its links has an affiliate URL on it
            and that link is live. No affiliate account is approved yet, so
            every link here is a plain retailer link and every click below
            sends somebody shopping for nothing. Paste an affiliate URL onto a
            piece in the outfit editor and it starts counting.
          </p>
        </div>
      ) : null}

      <section className={styles.section}>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <span>Looks that can earn</span>
            <b className={earning.length === 0 ? styles.warn : styles.ok}>
              {earning.length} of {published.length}
            </b>
            <small>At least one live, monetised link</small>
          </div>
          <div className={styles.tile}>
            <span>Clicks · 7 days</span>
            <b>{week.length}</b>
            <small>{month.length} in 30 days · {clicks.length} all time</small>
          </div>
          <div className={styles.tile}>
            <span>Links needing a person</span>
            <b className={issues.length === 0 ? styles.ok : styles.warn}>{issues.length}</b>
            <small>Dead, pending or unverified</small>
          </div>
          <div className={styles.tile}>
            <span>Published, no swap</span>
            <b className={queue.length === 0 ? styles.ok : styles.warn}>
              {queue.length} of {published.length}
            </b>
            <small>The half of the promise still unkept</small>
          </div>
        </div>
      </section>

      <section className={styles.section}>
          <Tally
            title="Clicks by look · 30 days"
            rows={byLook(month)}
            empty="No outbound clicks recorded in the last 30 days."
          />
          <Tally
            title="Clicks by retailer · 30 days"
            rows={byRetailer(month)}
            empty="No outbound clicks recorded in the last 30 days."
          />
        <Tally
          title="Clicks by side · 30 days"
          rows={bySide(month)}
          empty="No outbound clicks recorded in the last 30 days."
        />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Links needing a person</h2>
        </div>
        {issues.length === 0 ? (
          <div className={styles.empty}>
            <p>Every link is checked and live.</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Piece</th>
                    <th>Side</th>
                    <th>Retailer</th>
                    <th>Checked</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue) => (
                    <tr key={`${issue.outfitId}-${issue.piece}-${issue.side}`}>
                      <td>
                        <span className={styles.chip}>
                          {issue.networkMissing ? "no network set" : issue.status}
                        </span>
                      </td>
                      <td>
                        {issue.piece}
                        <small className={styles.muted}> · {issue.celebrity}</small>
                      </td>
                      <td>{issue.side === "original" ? "As worn" : "The swap"}</td>
                      <td>{issue.retailer}</td>
                      <td className={styles.muted}>{issue.checkedAt ?? "never"}</td>
                      <td className={styles.num}>
                        <Link href={`/admin/outfits/${issue.outfitId}`}>Edit</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Published looks with no swap</h2>
          <span className={styles.muted}>Newest first</span>
        </div>
        {queue.length === 0 ? (
          <div className={styles.empty}>
            <p>Every published look has at least one swap.</p>
          </div>
        ) : (
          <div className={styles.rows}>
            {queue.map((outfit) => (
              <Link
                className={styles.row}
                href={`/admin/outfits/${outfit.id}`}
                key={outfit.id}
              >
                <strong>{outfit.celebrity}</strong>
                <span>{outfit.event}</span>
                <span className={styles.num}>{outfit.date}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
