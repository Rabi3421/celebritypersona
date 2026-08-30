"use client";

import { useState, type ReactNode } from "react";
import styles from "@/app/admin/panel.module.css";

export type RowField = {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
};

/**
 * Rows posted as `prefix.0.key`, `prefix.1.key` and so on. Uncontrolled inputs
 * keyed by a stable row id, so adding or removing a row never shuffles what the
 * other rows contain.
 */
export function RepeatableRows({
  name,
  title,
  hint,
  fields,
  initial,
  columns,
  addLabel = "Add row",
  error,
}: {
  name: string;
  title: string;
  hint?: ReactNode;
  fields: RowField[];
  /** Extra keys are ignored, so a row object may carry richer values too. */
  initial: readonly Record<string, unknown>[];
  /** Grid template for one row, excluding the remove button. */
  columns: string;
  addLabel?: string;
  error?: string;
}) {
  const [rows, setRows] = useState(() =>
    (initial.length ? initial : [{}]).map((values, i) => ({
      id: i,
      values: values as Record<string, unknown>,
    })),
  );
  const [nextId, setNextId] = useState(rows.length);

  const add = () => {
    setRows((current) => [...current, { id: nextId, values: {} as Record<string, unknown> }]);
    setNextId((n) => n + 1);
  };
  const remove = (id: number) =>
    setRows((current) =>
      current.length === 1 ? current : current.filter((row) => row.id !== id),
    );

  return (
    <div className={styles.repeat}>
      <div className={styles.repeatHead}>
        <h2>{title}</h2>
        {hint ? <span>{hint}</span> : null}
      </div>
      {error ? <p className={styles.bad}>{error}</p> : null}

      {rows.map((row, index) => (
        <div
          className={styles.repeatRow}
          style={{ gridTemplateColumns: `${columns} auto` }}
          key={row.id}
        >
          {fields.map((field) => (
            <div className={styles.field} key={field.key}>
              <label htmlFor={`${name}.${index}.${field.key}`}>{field.label}</label>
              <input
                id={`${name}.${index}.${field.key}`}
                name={`${name}.${index}.${field.key}`}
                type={field.type ?? "text"}
                placeholder={field.placeholder}
                defaultValue={
                  typeof row.values[field.key] === "string" ||
                  typeof row.values[field.key] === "number"
                    ? (row.values[field.key] as string | number)
                    : ""
                }
              />
            </div>
          ))}
          <button
            className={`${styles.ghost} ${styles.drop}`}
            type="button"
            onClick={() => remove(row.id)}
            disabled={rows.length === 1}
            aria-label="Remove row"
          >
            Remove
          </button>
        </div>
      ))}

      <button className={styles.ghost} type="button" onClick={add}>
        {addLabel}
      </button>
    </div>
  );
}
