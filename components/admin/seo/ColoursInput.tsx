"use client";

import { useState } from "react";
import { PIECE_COLOURS, PIECE_COLOUR_NAMES } from "@/lib/taxonomy";
import styles from "@/app/admin/panel.module.css";

/**
 * A piece's colours, picked from the controlled list. A disclosure rather than
 * a wall of checkboxes, because it sits in every piece row. Posts the choice
 * comma-separated under `name`, which is what the schema reads.
 */
export function ColoursInput({ id, name, defaultValue }: { id: string; name: string; defaultValue: string }) {
  const [picked, setPicked] = useState(() =>
    defaultValue
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value in PIECE_COLOURS),
  );

  return (
    <details className={styles.colours}>
      <summary id={id}>
        {picked.length ? (
          picked.map((colour) => (
            <span key={colour}>
              <i style={{ background: PIECE_COLOURS[colour as keyof typeof PIECE_COLOURS] }} />
              {colour}
            </span>
          ))
        ) : (
          <em>Choose…</em>
        )}
      </summary>
      <div>
        {PIECE_COLOUR_NAMES.map((colour) => (
          <label key={colour}>
            <input
              type="checkbox"
              checked={picked.includes(colour)}
              onChange={() =>
                setPicked((current) =>
                  current.includes(colour) ? current.filter((value) => value !== colour) : [...current, colour],
                )
              }
            />
            <i style={{ background: PIECE_COLOURS[colour] }} />
            {colour}
          </label>
        ))}
      </div>
      <input type="hidden" name={name} value={picked.join(",")} />
    </details>
  );
}
