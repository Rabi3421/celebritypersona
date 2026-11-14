"use client";

import { useId, useState, type KeyboardEvent } from "react";
import styles from "./bi.module.css";

/**
 * One measure per IST day, as thin columns on a single axis.
 *
 * Read by hovering a column, or by focusing the chart (one tab stop) and
 * moving with the arrow keys; the reading is announced politely. Days before
 * the source has any data are drawn as "no data", not as zero. The same
 * numbers are always available as a table.
 */

export type DailyPoint = { day: string; value: number };

const dayLabel = (day: string, long = false) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    ...(long ? { weekday: "short" } : {}),
  });

/** A round number at or above the max, so the top gridline reads cleanly. */
function niceMax(max: number) {
  if (max <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= max) return m * step;
  return 10 * step;
}

export function DailyColumns({
  label,
  data,
  one,
  many,
  since,
}: {
  label: string;
  data: DailyPoint[];
  one: string;
  many: string;
  /** First day the source has data for; earlier days show "no data". */
  since: string | null;
}) {
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  const noData = (day: string) => !since || day < since;
  const top = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const reading = (i: number) => {
    const d = data[i];
    if (!d) return "";
    return noData(d.day) ? `${dayLabel(d.day, true)}: no data recorded yet` : `${dayLabel(d.day, true)}: ${d.value.toLocaleString("en-IN")} ${d.value === 1 ? one : many}`;
  };
  const move = (event: KeyboardEvent) => {
    const last = data.length - 1;
    const next = { ArrowLeft: (active ?? last + 1) - 1, ArrowRight: (active ?? -1) + 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(Math.max(0, Math.min(last, next)));
  };
  const ticks = [top, top / 2, 0];
  const labelled = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]);
  const align = (i: number) => (i < data.length / 4 ? "start" : i > (data.length * 3) / 4 ? "end" : "middle");

  return (
    <figure className={styles.chart}>
      <div
        className={styles.plot}
        tabIndex={0}
        role="group"
        aria-label={`${label}, per day. Use the left and right arrow keys to read each day.`}
        aria-describedby={`${id}-read`}
        onKeyDown={move}
        onFocus={() => setActive((a) => a ?? data.length - 1)}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
      >
        <div className={styles.axis} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t}>{Number.isInteger(t) ? t.toLocaleString("en-IN") : t.toFixed(1)}</span>
          ))}
        </div>
        <div className={styles.columns} style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }} aria-hidden="true">
          <i className={styles.gridline} style={{ bottom: "100%" }} />
          <i className={styles.gridline} style={{ bottom: "50%" }} />
          {data.map((d, i) => (
            <div key={d.day} className={`${styles.column} ${active === i ? styles.columnOn : ""}`} onPointerEnter={() => setActive(i)}>
              {noData(d.day) ? (
                <span className={styles.barNone} />
              ) : d.value > 0 ? (
                <span className={styles.bar} style={{ height: `${(d.value / top) * 100}%` }} />
              ) : null}
            </div>
          ))}
          {active !== null && data[active] ? (
            <div className={styles.tip} data-align={align(active)} style={{ left: `${((active + 0.5) / data.length) * 100}%` }}>
              {reading(active)}
            </div>
          ) : null}
        </div>
        <div className={styles.xaxis} style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }} aria-hidden="true">
          {data.map((d, i) => (
            <span key={d.day} data-align={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}>
              {labelled.has(i) ? dayLabel(d.day) : ""}
            </span>
          ))}
        </div>
        <p id={`${id}-read`} className={styles.srOnly} aria-live="polite">
          {active !== null ? reading(active) : ""}
        </p>
      </div>
      <details className={styles.tableView}>
        <summary>Show as table</summary>
        <div className={styles.tableScroll}>
          <table>
            <caption className={styles.srOnly}>{label}, per day (IST)</caption>
            <thead>
              <tr>
                <th scope="col">Day (IST)</th>
                <th scope="col">{many[0].toUpperCase() + many.slice(1)}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.day}>
                  <td>{dayLabel(d.day, true)}</td>
                  <td>{noData(d.day) ? "No data" : d.value.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
