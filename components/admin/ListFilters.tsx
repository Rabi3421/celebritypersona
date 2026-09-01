"use client";

import Link from "next/link";
import styles from "@/app/admin/panel.module.css";

export type FilterField =
  | { kind: "search"; name: string; label: string; value?: string; placeholder?: string }
  | {
      kind: "select";
      name: string;
      label: string;
      value?: string;
      options: { value: string; label: string }[];
    };

/**
 * The filter bar every list screen shares.
 *
 * A plain GET form, so the state lives in the URL: it survives a refresh, can
 * be bookmarked, and pages through without losing what you filtered to.
 * Choosing from a dropdown submits straight away where JavaScript is running;
 * the Apply button is what makes it work where it is not. Submitting drops the
 * `page` param, which is what you want — a new filter starts at page one.
 */
export function ListFilters({
  action,
  fields,
  active,
}: {
  action: string;
  fields: FilterField[];
  /** True when anything is filtered, so Reset only appears when it would do something. */
  active: boolean;
}) {
  return (
    <form className={styles.filters} method="get" action={action}>
      {fields.map((field) =>
        field.kind === "search" ? (
          <label className={styles.grow} key={field.name}>
            {field.label}
            <input
              type="search"
              name={field.name}
              defaultValue={field.value ?? ""}
              placeholder={field.placeholder}
            />
          </label>
        ) : (
          <label key={field.name}>
            {field.label}
            <select
              name={field.name}
              defaultValue={field.value ?? ""}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
            >
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ),
      )}
      <span className={styles.filterActions}>
        <button type="submit">Apply</button>
        {active ? <Link href={action}>Reset</Link> : null}
      </span>
    </form>
  );
}
