"use client";

import { useState } from "react";
import styles from "@/app/admin/panel.module.css";

/**
 * Every occasion the look suits, with one marked primary.
 *
 * The primary is what the breadcrumb, the "More … looks" rail and every older
 * reader use; the rest add the look to those occasion pages too. Posts
 * `occasion` (the primary) and `occasions` (all of them, comma-separated) —
 * the server folds the primary in again regardless, so the two cannot drift.
 *
 * A name not on the list can be typed and added; it gets a record, and an
 * occasion page, on save.
 */
export function OccasionPicker({
  options,
  primary,
  selected,
  error,
}: {
  options: string[];
  primary?: string;
  selected: string[];
  error?: string;
}) {
  const [chosen, setChosen] = useState<string[]>(() =>
    primary ? [primary, ...selected.filter((name) => name !== primary)] : selected,
  );
  const [lead, setLead] = useState(primary ?? chosen[0] ?? "");
  const [known, setKnown] = useState(() => [...new Set([...options, ...chosen])]);

  const toggle = (name: string) => {
    const next = chosen.includes(name) ? chosen.filter((value) => value !== name) : [...chosen, name];
    setChosen(next);
    // Unticking the primary hands it to the next one still ticked.
    if (!next.includes(lead)) setLead(next[0] ?? "");
  };

  const add = (typed: string) => {
    const name = typed.trim().replace(/\s+/g, " ");
    if (!name) return;
    const existing = known.find((value) => value.toLowerCase() === name.toLowerCase());
    const value = existing ?? name;
    if (!existing) setKnown((current) => [...current, value]);
    if (!chosen.includes(value)) toggle(value);
  };

  return (
    <fieldset className={`${styles.field} ${styles.wide} ${styles.occasionPicker}`}>
      <legend>Occasions</legend>
      <small>
        Tick every occasion this look works for — cocktail party, date night, New Year&apos;s Eve —
        and mark the one it is primarily filed under. Two or more is better: each one is a page the
        look appears on.
      </small>
      <div className={styles.occasionGrid}>
        {known.map((name) => {
          const on = chosen.includes(name);
          return (
            <div key={name} className={on ? styles.occasionOn : undefined}>
              <label>
                <input type="checkbox" checked={on} onChange={() => toggle(name)} />
                {name}
              </label>
              {on ? (
                <label className={styles.primaryPick}>
                  <input
                    type="radio"
                    name="occasion-primary"
                    checked={lead === name}
                    onChange={() => setLead(name)}
                  />
                  primary
                </label>
              ) : null}
            </div>
          );
        })}
      </div>
      <input
        className={styles.occasionAdd}
        placeholder="Add another, e.g. Date night — press Enter"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add(event.currentTarget.value);
            event.currentTarget.value = "";
          }
        }}
      />
      {error ? <p className={styles.bad}>{error}</p> : null}
      <input type="hidden" name="occasion" value={lead} />
      <input type="hidden" name="occasions" value={chosen.join(",")} />
    </fieldset>
  );
}
