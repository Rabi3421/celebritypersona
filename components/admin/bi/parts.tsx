import Link from "next/link";
import type { ReactNode } from "react";
import type { Action, Priority } from "@/lib/bi/actions";
import type { Comparison, Period } from "@/lib/bi/period";
import { MAX_CUSTOM_DAYS, addDays, istDay } from "@/lib/bi/period";
import type { SourceState } from "@/lib/bi/sources";
import styles from "./bi.module.css";

export const num = (n: number) => n.toLocaleString("en-IN");
export const dayText = (day: string, year = false) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });

/** Where a figure comes from — on every number, so populations are never confused. */
export function Source({ children }: { children: ReactNode }) {
  return <span className={styles.source}>{children}</span>;
}

export function Section({ id, title, intro, source, children }: { id: string; title: string; intro?: ReactNode; source?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section} id={id} aria-labelledby={`${id}-title`}>
      <header className={styles.sectionHead}>
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          {intro ? <p>{intro}</p> : null}
        </div>
        {source ? <Source>{source}</Source> : null}
      </header>
      {children}
    </section>
  );
}

export function Delta({ comparison }: { comparison: Comparison }) {
  if (comparison.kind === "none") return <p className={styles.delta}>{comparison.text}</p>;
  const icon = comparison.direction === "up" ? "▲" : comparison.direction === "down" ? "▼" : "■";
  return (
    <p className={styles.delta} data-direction={comparison.direction}>
      <span aria-hidden="true">{icon} </span>
      {comparison.text}
    </p>
  );
}

export function Kpi({
  label,
  value,
  star,
  comparison,
  note,
  source,
  state = "ok",
}: {
  label: string;
  value: ReactNode;
  star?: boolean;
  comparison?: Comparison;
  note?: ReactNode;
  source: ReactNode;
  state?: "ok" | "not-connected" | "error" | "no-data" | "loading";
}) {
  return (
    <div className={`${styles.kpi} ${star ? styles.kpiStar : ""}`} aria-busy={state === "loading" || undefined}>
      <div className={styles.kpiHead}>
        <h3>{label}</h3>
        {star ? <span className={styles.starTag}>North star</span> : null}
      </div>
      {state === "ok" ? (
        <p className={styles.kpiValue}>{value}</p>
      ) : state === "loading" ? (
        <p className={styles.kpiValue}>
          <span className={styles.skeleton} aria-hidden="true" />
          <span className={styles.srOnly}>Loading</span>
        </p>
      ) : (
        <p className={styles.kpiMissing}>
          <State state={state} />
        </p>
      )}
      {comparison && state === "ok" ? <Delta comparison={comparison} /> : null}
      {note ? <p className={styles.kpiNote}>{note}</p> : null}
      <Source>{source}</Source>
    </div>
  );
}

type StateKey = SourceState | "ok" | "no-data";
const STATE_TEXT: Record<StateKey, [string, string]> = {
  ok: ["●", "Connected"],
  connected: ["●", "Connected"],
  stale: ["◐", "Stale"],
  error: ["▲", "Failing"],
  "not-connected": ["○", "Not connected"],
  "no-data": ["–", "No data for this period"],
};
export function State({ state }: { state: StateKey }) {
  const [icon, text] = STATE_TEXT[state];
  return (
    <span className={styles.state} data-state={state}>
      <span aria-hidden="true">{icon}</span> {text}
    </span>
  );
}

/** Ranked rows with a thin bar each: top looks, retailers, devices… */
export function BarList({ rows, empty, unit }: { rows: { label: ReactNode; value: number; key: string; href?: string; note?: string }[]; empty: string; unit: [string, string] }) {
  if (!rows.length) return <p className={styles.none}>{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ol className={styles.barList}>
      {rows.map((row) => (
        <li key={row.key}>
          <span className={styles.barLabel}>
            {row.href ? <Link href={row.href}>{row.label}</Link> : row.label}
            {row.note ? <small>{row.note}</small> : null}
          </span>
          <span className={styles.barValue}>
            {num(row.value)} <span className={styles.srOnly}>{row.value === 1 ? unit[0] : unit[1]}</span>
          </span>
          <span className={styles.barTrack} aria-hidden="true">
            <span style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
          </span>
        </li>
      ))}
    </ol>
  );
}

/** "11 of 15" with a meter, for coverage figures. */
export function Coverage({ label, part, whole, href }: { label: string; part: number; whole: number; href?: string }) {
  const pct = whole ? Math.round((part / whole) * 100) : 0;
  return (
    <div className={styles.coverage}>
      <div className={styles.coverageHead}>
        <span>{href ? <Link href={href}>{label}</Link> : label}</span>
        <b>
          {num(part)} of {num(whole)}
          <small> ({pct}%)</small>
        </b>
      </div>
      <meter min={0} max={Math.max(whole, 1)} value={part} aria-label={`${label}: ${part} of ${whole}`} className={styles.meter} />
    </div>
  );
}

export function Panel({ title, source, children }: { title: string; source?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h3>{title}</h3>
        {source ? <Source>{source}</Source> : null}
      </div>
      {children}
    </div>
  );
}

const PRIORITY: Record<Priority, [string, string]> = { high: ["▲", "High"], medium: ["◆", "Medium"], low: ["●", "Low"] };
export function PriorityTag({ priority }: { priority: Priority }) {
  const [icon, text] = PRIORITY[priority];
  return (
    <span className={styles.priority} data-priority={priority}>
      <span aria-hidden="true">{icon}</span> {text} priority
    </span>
  );
}

/**
 * One action as a compact row: priority, what, and the evidence in one line,
 * with the way to act beside it. Why, the next step and where to start open
 * underneath, so a long list stays scannable.
 */
export function ActionRow({ action }: { action: Action }) {
  const internal = action.href.startsWith("/");
  return (
    <li className={styles.action} data-priority={action.priority}>
      <details>
        <summary>
          <span className={styles.actionMeta}>
            <PriorityTag priority={action.priority} />
            <span>{action.area}</span>
          </span>
          <span className={styles.actionTitle}>{action.title}</span>
          <span className={styles.actionEvidence}>{action.evidence}</span>
        </summary>
        <div className={styles.actionBody}>
          <dl className={styles.actionFacts}>
            <div>
              <dt>Why it matters</dt>
              <dd>{action.why}</dd>
            </div>
            <div>
              <dt>Next step</dt>
              <dd>{action.next}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{action.confidence === "high" ? "High — read directly from stored records" : "Medium — inferred from stored records"}</dd>
            </div>
          </dl>
          {action.examples.length ? (
            <ul className={styles.examples} aria-label="Start with">
              {action.examples.map((e) => (
                <li key={e.href + e.label}>
                  <Link href={e.href}>{e.label}</Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </details>
      {internal ? (
        <Link className={styles.actionLink} href={action.href}>
          {action.hrefLabel} <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <a className={styles.actionLink} href={action.href}>
          {action.hrefLabel} <span aria-hidden="true">↓</span>
        </a>
      )}
    </li>
  );
}

/** "5 clicks · 3 of 7 days active · busiest 13 Nov (3)" — readable even when the chart is mostly empty. */
export function ChartFacts({ facts, unit }: { facts: { total: number; coveredDays: number; activeDays: number; best: { day: string; value: number } | null }; unit: [string, string] }) {
  if (!facts.coveredDays) return <p className={styles.chartFacts}>No data recorded for this period.</p>;
  return (
    <p className={styles.chartFacts}>
      <b>{num(facts.total)}</b> {facts.total === 1 ? unit[0] : unit[1]} · {facts.activeDays} of {facts.coveredDays} recorded days active
      {facts.best ? ` · busiest ${dayText(facts.best.day)} (${num(facts.best.value)})` : ""}
    </p>
  );
}

const RANGES: { key: Period["key"]; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 days" },
  { key: "28d", label: "28 days" },
];

/** Plain links and a GET form: works without JavaScript, and every state has a URL. */
export function RangePicker({ period, now }: { period: Period; now: number }) {
  const today = istDay(now);
  return (
    <div className={styles.range}>
      <nav aria-label="Date range">
        <ul>
          {RANGES.map((r) => (
            <li key={r.key}>
              <Link href={r.key === "28d" ? "/admin" : `/admin?range=${r.key}`} aria-current={period.key === r.key ? "page" : undefined} scroll={false}>
                {r.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <details className={styles.custom} open={period.key === "custom" || Boolean(period.notice)}>
        <summary aria-current={period.key === "custom" ? "page" : undefined}>Custom</summary>
        <form method="get" action="/admin" className={styles.customForm}>
          <input type="hidden" name="range" value="custom" />
          <label>
            From
            <input type="date" name="from" required min={addDays(today, -400)} max={today} defaultValue={period.key === "custom" ? period.from : addDays(today, -14)} />
          </label>
          <label>
            To
            <input type="date" name="to" required min={addDays(today, -400)} max={today} defaultValue={period.key === "custom" ? period.to : addDays(today, -1)} />
          </label>
          <button type="submit">Apply</button>
          <small>Up to {MAX_CUSTOM_DAYS} days, IST.</small>
        </form>
      </details>
    </div>
  );
}
