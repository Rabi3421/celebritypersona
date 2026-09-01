"use client";

import styles from "@/app/admin/panel.module.css";

/**
 * A status dropdown that saves on change, and a delete that asks first.
 *
 * Shared by the reports, requests and subscriber tables: three inboxes with
 * the same two things to do to a row, so they behave identically rather than
 * each inventing its own.
 */
export function StatusRowActions({
  id,
  status,
  statuses,
  label,
  confirm,
  onStatus,
  onDelete,
}: {
  id: string;
  status: string;
  statuses: readonly string[];
  /** Describes the row, for the screen reader on the select. */
  label: string;
  confirm: string;
  onStatus: (form: FormData) => Promise<void>;
  onDelete: (form: FormData) => Promise<void>;
}) {
  return (
    <span className={styles.rowActions}>
      <form action={onStatus}>
        <input type="hidden" name="id" value={id} />
        <select
          name="status"
          defaultValue={status}
          aria-label={`Status for ${label}`}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          {statuses.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </form>
      <form
        action={onDelete}
        onSubmit={(event) => {
          if (!window.confirm(confirm)) event.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button type="submit">Delete</button>
      </form>
    </span>
  );
}
