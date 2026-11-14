import Link from "next/link";
import { Suspense } from "react";
import { DailyColumns } from "@/components/admin/bi/DailyColumns";
import { ActionRow, BarList, ChartFacts, Coverage, Kpi, Panel, RangePicker, Section, Source, State, dayText, num } from "@/components/admin/bi/parts";
import bi from "@/components/admin/bi/bi.module.css";
import { requireAdmin } from "@/lib/auth/admin";
import { compare, coverage, istStamp, type Period } from "@/lib/bi/period";
import { loadOverview, type Overview as Data } from "@/lib/bi/overview";
import { trafficSource, UNCONNECTED } from "@/lib/bi/sources";
import { briefing, dailyFacts } from "@/lib/bi/summary";
import type { TrafficSummary } from "@/lib/bi/traffic";
import { grievanceOfficer, legalEntity, pending } from "@/lib/site-config";
import styles from "@/app/admin/panel.module.css";

/**
 * The Overview: a solo founder's business dashboard.
 *
 * Every figure names its source and population. Shop clicks come from the
 * server-side click log (production only); traffic comes from PostHog and
 * covers only browsers that accepted analytics; the two are never divided by
 * each other. There is no revenue figure: no affiliate network reports to
 * this site, and a click is not a sale.
 *
 * MongoDB figures render first; PostHog streams in behind its own loading
 * state, so a slow or failing PostHog never holds the page.
 */
export const dynamic = "force-dynamic";

const ACTIONS_SHOWN = 6;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
type Look = Data["looks"][number];

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The layout also checks; this keeps the data below from loading for anyone else.
  await requireAdmin();
  const params = await searchParams;
  const o = await loadOverview({ range: first(params.range), from: first(params.from), to: first(params.to) });
  const { period, content, clicks } = o;
  const unfilledLegal = [legalEntity.name, grievanceOfficer.name].filter(pending).length;
  const lookById = new Map(o.looks.map((l) => [l.id, l]));
  const periodDates = period.days === 1 ? dayText(period.from, true) : `${dayText(period.from)} – ${dayText(period.to, true)}`;
  const csvQuery = new URLSearchParams({ range: period.key, ...(period.key === "custom" ? { from: period.from, to: period.to } : {}) });
  const clickCoverage = clicks ? coverage(period, clicks.since) : "none";
  const live = content.links.live;
  const brief = briefing({ period, clicks, content, actions: o.actions });
  const clickPoints = (clicks?.daily ?? []).map((d) => ({ day: d.day, value: d.total }));

  return (
    <div className={bi.page}>
      {o.db ? null : (
        <div className={styles.notice} role="alert">
          <strong>The database is unreachable</strong>
          <p>
            Nothing from MongoDB on this screen is current, and the public site is serving whatever it last built. Check MONGODB_URI and that this
            machine&apos;s IP is on the Atlas access list.
          </p>
        </div>
      )}
      {unfilledLegal > 0 ? (
        <div className={styles.notice}>
          <strong>
            {unfilledLegal} legal detail{unfilledLegal === 1 ? "" : "s"} still unfilled
          </strong>
          <p>
            The operator&apos;s legal name and the Grievance Officer&apos;s name belong on the public policy pages (DPDP Act 2023, IT Rules 2021) and
            are left out of them until set. Fill them in <Link href="/admin/settings">Settings</Link>.
          </p>
        </div>
      ) : null}

      <div className={bi.toolbar}>
        <div className={bi.periodText}>
          <p className={bi.periodLabel}>
            <strong>{period.label}</strong> · {periodDates}
          </p>
          <p className={bi.updated}>
            India Standard Time · Updated {istStamp(o.now)}
            {period.complete ? "" : " · Today is still in progress"}
          </p>
        </div>
        <RangePicker period={period} now={o.now} />
      </div>
      {period.notice ? (
        <p className={bi.rangeNotice} role="status">
          {period.notice}
        </p>
      ) : null}

      {/* A. Executive overview: the 30-second read, then the headline figures */}
      <section className={bi.section} aria-labelledby="exec-title">
        <h2 id="exec-title" className={bi.srOnly}>
          Executive overview
        </h2>
        <div className={bi.brief}>
          <ul>
            <li>
              <span className={bi.briefKey}>Shopping</span> {brief.shopping}
            </li>
            <li>
              <span className={bi.briefKey}>Traffic</span>{" "}
              <Suspense fallback={<span className={bi.skeletonText}>Loading PostHog…</span>}>
                <TrafficBrief traffic={o.traffic} period={period} />
              </Suspense>
            </li>
            <li>
              <span className={bi.briefKey}>Publishing</span> {brief.publishing}
            </li>
            {brief.top ? (
              <li>
                <span className={bi.briefKey}>Do first</span> <a href="#actions">{brief.top}</a>
              </li>
            ) : null}
          </ul>
        </div>
        <div className={bi.kpis}>
          <Kpi
            star
            label="Shop clicks"
            state={!clicks ? "error" : clickCoverage === "none" ? "no-data" : "ok"}
            value={num(clicks?.current.total ?? 0)}
            comparison={clicks ? compare(clicks.current.total, clicks.previous.total, period, clicks.since) : undefined}
            note={
              clicks
                ? clickCoverage === "none"
                  ? `Production clicks are recorded from ${clicks.since ? dayText(clicks.since, true) : "the first tagged click"}.`
                  : `${num(clicks.current.original)} to originals · ${num(clicks.current.swap)} to swaps${clicks.current.other ? ` · ${num(clicks.current.other)} unclassified` : ""}. A visit to a retailer, not a sale.${clickCoverage === "partial" ? ` Partial: data from ${dayText(clicks.since!)}.` : ""}`
                : "Click data could not be read."
            }
            source="Click log · production · bots excluded"
          />
          <Suspense fallback={<Kpi label="Outfit views" state="loading" value={null} source="PostHog · consenting browsers only" />}>
            <TrafficKpi traffic={o.traffic} period={period} />
          </Suspense>
          <Kpi
            label="Live looks"
            value={num(content.looks.live)}
            note={`${num(content.publishing.publishedInPeriod.length)} first published in this period · ${num(content.looks.drafts)} draft${content.looks.drafts === 1 ? "" : "s"}`}
            source="MongoDB · now"
          />
          <Kpi
            label="Live shop links OK"
            value={
              <>
                {num(live.byStatus.ok)}
                <small> / {num(live.total)}</small>
              </>
            }
            note={`${num(live.byStatus.sold_out + live.byStatus.dead)} sold out or dead · ${num(live.byStatus.unverified + live.byStatus.pending)} unverified, on live looks`}
            source="MongoDB · link status now"
          />
          <Kpi
            label="Monetised clicks"
            state={!clicks ? "error" : clickCoverage === "none" ? "no-data" : "ok"}
            value={num(clicks?.current.affiliate ?? 0)}
            note={`${num(content.links.affiliate)} of ${num(content.links.total)} links carry an affiliate URL. No network reports revenue to this site.`}
            source="Click log · production"
          />
          <Kpi label="Google clicks" state="not-connected" value={null} note={<a href="#search">Search Console is not connected</a>} source="Google Search Console" />
        </div>
      </section>

      <nav className={bi.jump} aria-label="Dashboard sections">
        <a href="#actions">Actions</a>
        <a href="#commerce">Shopping</a>
        <a href="#traffic">Traffic</a>
        <a href="#content">Content</a>
        <a href="#search">Search</a>
        <a href="#sources">Data sources</a>
        <a href="#activity">Activity</a>
        <a href={`/api/admin/overview-csv?${csvQuery}`} className={bi.download} download>
          Download daily CSV
        </a>
      </nav>

      {/* G. Founder Action Center */}
      <Section
        id="actions"
        title="Action center"
        intro={`${o.actions.length} things worth doing, highest priority first. Open a row for why, the next step and where to start. Worked out from stored records on this load; no status history is kept yet, so nothing is marked new or resolved.`}
      >
        {o.actions.length === 0 ? (
          <p className={bi.none}>Nothing needs doing.</p>
        ) : (
          <>
            <ol className={bi.actions}>
              {o.actions.slice(0, ACTIONS_SHOWN).map((a) => (
                <ActionRow key={a.id} action={a} />
              ))}
            </ol>
            {o.actions.length > ACTIONS_SHOWN ? (
              <details className={bi.more}>
                <summary>
                  Show {o.actions.length - ACTIONS_SHOWN} more action{o.actions.length - ACTIONS_SHOWN === 1 ? "" : "s"}
                </summary>
                <ol className={bi.actions} start={ACTIONS_SHOWN + 1}>
                  {o.actions.slice(ACTIONS_SHOWN).map((a) => (
                    <ActionRow key={a.id} action={a} />
                  ))}
                </ol>
              </details>
            ) : null}
          </>
        )}
      </Section>

      {/* D. Shopping and affiliate */}
      <Section
        id="commerce"
        title="Shopping"
        intro="Clicks on Buy buttons that reached a retailer, recorded by the site's own redirect. Production only; preview, local and untagged clicks are left out."
        source="Click log"
      >
        {clicks ? (
          <>
            <Panel title="Shop clicks per day">
              <ChartFacts facts={dailyFacts(clickPoints, clicks.since)} unit={["click", "clicks"]} />
              {period.days > 1 ? <DailyColumns label="Production shop clicks" data={clickPoints} one="click" many="clicks" since={clicks.since} /> : null}
              {clickCoverage === "partial" || clickCoverage === "none" ? (
                <p className={bi.footnote}>
                  Clicks were first tagged as production on {clicks.since ? dayText(clicks.since, true) : "—"}; days before that have no data. Older, untagged
                  clicks cannot be told apart from test clicks, so they are never counted.
                </p>
              ) : null}
            </Panel>
            <div className={bi.grid3}>
              <Panel title="Most-clicked looks">
                <BarList
                  unit={["click", "clicks"]}
                  empty="No production clicks in this period."
                  rows={clicks.topOutfits.map((r) => {
                    const look = r.id !== null ? lookById.get(r.id) : undefined;
                    return { key: `${r.id}-${r.slug}`, label: look?.name ?? (r.slug || "Unknown look"), value: r.clicks, href: look ? `/admin/outfits/${look.id}` : undefined, note: look ? undefined : "no longer in the archive" };
                  })}
                />
              </Panel>
              <Panel title="Retailers">
                <BarList unit={["click", "clicks"]} empty="No production clicks in this period." rows={clicks.retailers.map((r) => ({ key: r.name, label: r.name, value: r.clicks }))} />
              </Panel>
              <Panel title="Pieces">
                <BarList
                  unit={["click", "clicks"]}
                  empty="No production clicks in this period."
                  rows={clicks.pieces.map((r) => ({ key: `${r.outfitId}-${r.piece}-${r.side}`, label: r.piece, value: r.clicks, note: `${r.side || "unknown side"} · ${r.outfitId !== null ? (lookById.get(r.outfitId)?.name ?? "removed look") : "unknown look"}` }))}
                />
              </Panel>
            </div>
            <div className={bi.grid2}>
              <Panel title="Where clicks went">
                <dl className={bi.split}>
                  <div>
                    <dt>To the original piece</dt>
                    <dd>{num(clicks.current.original)}</dd>
                  </div>
                  <div>
                    <dt>To a swap</dt>
                    <dd>{num(clicks.current.swap)}</dd>
                  </div>
                  <div>
                    <dt>Monetised (affiliate URL)</dt>
                    <dd>{num(clicks.current.affiliate)}</dd>
                  </div>
                  <div>
                    <dt>Plain retailer link</dt>
                    <dd>{num(clicks.current.direct)}</dd>
                  </div>
                </dl>
                <p className={bi.footnote}>
                  Left out of every total in this period: {num(clicks.excluded.unclassified)} untagged (recorded before environment tagging),{" "}
                  {num(clicks.excluded.preview)} preview, {num(clicks.excluded.local)} local or development.
                  {clicks.current.other ? ` ${num(clicks.current.other)} production click${clicks.current.other === 1 ? "" : "s"} had no side recorded.` : ""}
                </p>
              </Panel>
              <Panel title="Shop-link health · live looks" source="MongoDB · now">
                <BarList
                  unit={["link", "links"]}
                  empty="No shop links on live looks yet."
                  rows={(
                    [
                      ["ok", "OK"],
                      ["unverified", "Unverified"],
                      ["pending", "Pending"],
                      ["sold_out", "Sold out"],
                      ["dead", "Dead"],
                    ] as const
                  )
                    .filter(([k]) => live.byStatus[k] > 0)
                    .map(([k, label]) => ({ key: k, label, value: live.byStatus[k] }))}
                />
                <p className={bi.footnote}>
                  {content.links.total > live.total ? `${num(content.links.total - live.total)} more link${content.links.total - live.total === 1 ? "" : "s"} on drafts or looks not yet live. ` : ""}
                  Across all looks: {num(content.links.neverChecked.length)} never checked · {num(content.links.stale.length)} last checked over {content.links.staleDays} days ago ·{" "}
                  {num(content.links.affiliate)} with an affiliate URL.
                </p>
              </Panel>
            </div>
          </>
        ) : (
          <p className={bi.none}>
            <State state="error" /> The click log could not be read on this load. Reload to try again.
          </p>
        )}
      </Section>

      {/* B. Traffic and acquisition */}
      <Section
        id="traffic"
        title="Traffic"
        intro="Production visits from browsers that accepted analytics. Visitors who declined, or block analytics, are not counted, so this undercounts real traffic."
        source="PostHog"
      >
        <Suspense fallback={<SectionLoading what="traffic" />}>
          <TrafficSection traffic={o.traffic} period={period} />
        </Suspense>
      </Section>

      {/* C. Outfit and content */}
      <Section id="content" title="Content" intro="What the archive holds right now, and what was first published in this period.">
        <div className={bi.grid3}>
          <Panel title="Looks" source="MongoDB · now">
            <dl className={bi.split}>
              <div>
                <dt>Live</dt>
                <dd>{num(content.looks.live)}</dd>
              </div>
              <div>
                <dt>Drafts</dt>
                <dd>{num(content.looks.drafts)}</dd>
              </div>
              <div>
                <dt>Saved, not live</dt>
                <dd>{num(content.looks.heldBack)}</dd>
              </div>
              <div>
                <dt>Pieces on live looks</dt>
                <dd>{num(content.looks.pieces)}</dd>
              </div>
            </dl>
          </Panel>
          <Panel title="Search readiness" source="MongoDB · live looks">
            <Coverage label="Primary keyword set" part={content.search.live - content.search.withoutKeyword.length} whole={content.search.live} />
            <Coverage label="SEO title set" part={content.search.live - content.search.withoutTitle} whole={content.search.live} />
            <Coverage label="SEO description set" part={content.search.live - content.search.withoutDescription} whole={content.search.live} />
          </Panel>
          <Panel title="First published in this period" source="MongoDB">
            {content.publishing.publishedInPeriod.length ? (
              <ul className={bi.plainList}>
                {content.publishing.publishedInPeriod.slice(0, 8).map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/outfits/${p.id}`}>{p.name}</Link> <small>{dayText(p.publishedAt)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={bi.none}>
                None.{content.publishing.last ? ` The last first-publish was ${dayText(content.publishing.last, true)}.` : ""}
              </p>
            )}
            <p className={bi.footnote}>
              {content.publishing.withoutDate
                ? `${num(content.publishing.withoutDate)} live look${content.publishing.withoutDate === 1 ? "" : "s"} went live before publish dates were recorded and cannot be counted here. `
                : ""}
              Publish dates are stored as UTC days, so a look published before 05:30 IST counts on the previous day.
            </p>
          </Panel>
        </div>
        <div className={bi.grid2}>
          <Panel title="Most-viewed looks" source="PostHog · consenting browsers">
            <Suspense fallback={<p className={bi.skeletonText}>Loading PostHog…</p>}>
              <MostViewed traffic={o.traffic} looks={o.looks} />
            </Suspense>
          </Panel>
          <Panel title="Most-clicked looks" source="Click log · production">
            {clicks ? (
              <BarList
                unit={["click", "clicks"]}
                empty="No production clicks in this period."
                rows={clicks.topOutfits.map((r) => {
                  const look = r.id !== null ? lookById.get(r.id) : undefined;
                  return { key: `${r.id}-${r.slug}`, label: look?.name ?? (r.slug || "Unknown look"), value: r.clicks, href: look ? `/admin/outfits/${look.id}` : undefined };
                })}
              />
            ) : (
              <p className={bi.none}>
                <State state="error" /> Click log unavailable.
              </p>
            )}
          </Panel>
        </div>
        <p className={bi.footnote}>
          Views and clicks come from different populations (consenting browsers vs every non-bot click), so they are shown side by side and never divided into a
          rate.
        </p>
      </Section>

      {/* E. SEO */}
      <Section id="search" title="Search" source="Google Search Console">
        <div className={bi.missing}>
          <State state="not-connected" />
          <p>
            Google clicks, impressions, average position, top queries and indexing come from Search Console, which this site does not read yet. No
            search figure is estimated in its place.
          </p>
          <p>
            Meanwhile: {num(content.search.withoutKeyword.length)} of {num(content.search.live)} live looks have no primary keyword.{" "}
            <Link href="/admin/outfits">Open outfits</Link>
          </p>
        </div>
      </Section>

      {/* F. System health */}
      <Section id="sources" title="Data sources" intro="What this dashboard reads, whether it is current, and what it cannot see yet.">
        <div className={bi.tableScroll}>
          <table className={bi.sourceTable}>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Status</th>
                <th scope="col">Provides</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              <SourceRow source={o.sources.database} />
              <SourceRow source={o.sources.clicks} />
              <Suspense
                fallback={
                  <tr>
                    <th scope="row">PostHog (consenting browsers)</th>
                    <td colSpan={3}>
                      <span className={bi.skeletonText}>Checking…</span>
                    </td>
                  </tr>
                }
              >
                <TrafficSourceRow traffic={o.traffic} today={o.today} />
              </Suspense>
              {UNCONNECTED.map((s) => (
                <SourceRow key={s.key} source={s} />
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* H. Recent activity */}
      <Section
        id="activity"
        title="Recent activity"
        intro="Read from dates the records already store. There is no audit log, so edits, deploys and incidents are not listed. Look and link dates are UTC days; subscriber and click days are IST."
      >
        {o.activity.length ? (
          <ol className={bi.activity}>
            {o.activity.map((a, i) => (
              <li key={`${a.kind}-${a.at}-${i}`}>
                <time dateTime={a.day}>{dayText(a.day, true)}</time>
                <span>{a.href ? <Link href={a.href}>{a.text}</Link> : a.text}</span>
                <Source>{a.kind === "clicks" ? "Click log" : "MongoDB"}</Source>
              </li>
            ))}
          </ol>
        ) : (
          <p className={bi.none}>No dated activity recorded yet.</p>
        )}
        <p className={bi.footnote}>
          {num(o.subscribers)} active subscriber{o.subscribers === 1 ? "" : "s"}. &ldquo;Saved&rdquo; uses the last-saved date each look stores, so it
          shows only the latest save.
        </p>
      </Section>
    </div>
  );
}

/* ---------- PostHog-backed parts: each awaits the same cached promise ---------- */

function SectionLoading({ what }: { what: string }) {
  return (
    <div className={bi.loadingPanel} aria-busy="true">
      <span className={bi.skeletonText}>Loading {what} from PostHog…</span>
      <span className={bi.skeletonBlock} aria-hidden="true" />
    </div>
  );
}

function SourceRow({ source }: { source: { name: string; state: Parameters<typeof State>[0]["state"]; provides: string; detail: string } }) {
  return (
    <tr>
      <th scope="row">{source.name}</th>
      <td>
        <State state={source.state} />
      </td>
      <td>{source.provides}</td>
      <td>{source.detail}</td>
    </tr>
  );
}

async function TrafficSourceRow({ traffic, today }: { traffic: Promise<TrafficSummary>; today: string }) {
  return <SourceRow source={trafficSource(await traffic, today)} />;
}

async function TrafficBrief({ traffic, period }: { traffic: Promise<TrafficSummary>; period: Period }) {
  const t = await traffic;
  if (t.status !== "ok") return <>{t.status === "not-connected" ? "Not connected — PostHog needs a read-only key." : `Unavailable — ${t.reason}`}</>;
  if (coverage(period, t.since) === "none") return <>No PostHog data covers this period.</>;
  const top = t.breakdowns.source[0];
  return (
    <>
      {num(t.current.pageviews)} page views and {num(t.current.outfitViews)} outfit views from {num(t.current.browsers)} consenting browser
      {t.current.browsers === 1 ? "" : "s"}
      {top ? `; top source: ${top.value}` : ""}.
    </>
  );
}

async function TrafficKpi({ traffic, period }: { traffic: Promise<TrafficSummary>; period: Period }) {
  const t = await traffic;
  const cov = t.status === "ok" ? coverage(period, t.since) : "none";
  return (
    <Kpi
      label="Outfit views"
      state={t.status !== "ok" ? t.status : cov === "none" ? "no-data" : "ok"}
      value={num(t.status === "ok" ? t.current.outfitViews : 0)}
      comparison={t.status === "ok" ? compare(t.current.outfitViews, t.previous.outfitViews, period, t.since) : undefined}
      note={
        t.status === "ok" ? (
          cov === "none" ? (
            `PostHog has production data from ${t.since ? dayText(t.since, true) : "—"}.`
          ) : (
            `${num(t.current.pageviews)} page views from ${num(t.current.browsers)} browsers.${cov === "partial" ? ` Partial: data from ${dayText(t.since!)}.` : ""}`
          )
        ) : (
          <a href="#sources">Why this is missing</a>
        )
      }
      source="PostHog · consenting browsers only"
    />
  );
}

async function MostViewed({ traffic, looks }: { traffic: Promise<TrafficSummary>; looks: Look[] }) {
  const t = await traffic;
  if (t.status !== "ok")
    return (
      <p className={bi.none}>
        <State state={t.status} /> Needs PostHog.
      </p>
    );
  const bySlug = new Map(looks.map((l) => [l.slug, l]));
  return (
    <BarList
      unit={["view", "views"]}
      empty="No outfit views in this period."
      rows={t.breakdowns.outfit.map((r) => {
        const look = bySlug.get(r.value);
        return { key: r.value, label: look?.name ?? r.value, value: r.n, href: look ? `/admin/outfits/${look.id}` : undefined };
      })}
    />
  );
}

async function TrafficSection({ traffic, period }: { traffic: Promise<TrafficSummary>; period: Period }) {
  const t = await traffic;
  if (t.status !== "ok")
    return (
      <div className={bi.missing}>
        <State state={t.status} />
        <p>{t.reason}</p>
        <p>Shop clicks above do not depend on this. They come from the site&apos;s own click log.</p>
      </div>
    );
  const points = t.daily.map((d) => ({ day: d.day, value: d.pageviews }));
  const cov = coverage(period, t.since);
  return (
    <>
      <Panel title="Page views per day">
        <ChartFacts facts={dailyFacts(points, t.since)} unit={["page view", "page views"]} />
        {period.days > 1 ? <DailyColumns label="Page views from consenting browsers" data={points} one="page view" many="page views" since={t.since} /> : null}
        {cov !== "full" ? <p className={bi.footnote}>PostHog has production data from {t.since ? dayText(t.since, true) : "—"}; earlier days have no data.</p> : null}
      </Panel>
      <div className={bi.grid4}>
        <Panel title="Top pages">
          <BarList unit={["view", "views"]} empty="No page views in this period." rows={t.breakdowns.page.map((r) => ({ key: r.value, label: r.value, value: r.n }))} />
        </Panel>
        <Panel title="Sources">
          <BarList unit={["view", "views"]} empty="No page views in this period." rows={t.breakdowns.source.map((r) => ({ key: r.value, label: r.value, value: r.n }))} />
          <p className={bi.footnote}>
            &ldquo;Campaign&rdquo; is the link&apos;s utm_source tag. &ldquo;Direct or unknown&rdquo; includes visits whose referrer the browser withheld.
          </p>
        </Panel>
        <Panel title="Devices">
          <BarList unit={["view", "views"]} empty="No page views in this period." rows={t.breakdowns.device.map((r) => ({ key: r.value, label: r.value, value: r.n }))} />
        </Panel>
        <Panel title="Countries">
          <BarList unit={["view", "views"]} empty="No page views in this period." rows={t.breakdowns.country.map((r) => ({ key: r.value, label: r.value, value: r.n }))} />
        </Panel>
      </div>
      <p className={bi.footnote}>
        Page views count every view; browsers count distinct consenting browsers, not people. Fetched {istStamp(t.fetchedAt)}; refreshed at most every 10
        minutes.
      </p>
    </>
  );
}
