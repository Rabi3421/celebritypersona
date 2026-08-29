"use client";

import { removeReport, updateReportStatus } from "@/app/admin/(panel)/reports/actions";
import type { PriceReport } from "@/lib/types";
import styles from "@/app/admin/panel.module.css";

const STATUSES: PriceReport["status"][] = [
  "New",
  "Checked",
  "Fixed",
  "No change needed",
];

/** Changing the status submits immediately; there is nothing else to confirm. */
export function ReportRowActions({ report }: { report: PriceReport }) {
  return (
    <span className={styles.rowActions}>
      <form action={updateReportStatus}>
        <input type="hidden" name="id" value={report.id} />
        <select
          name="status"
          defaultValue={report.status}
          aria-label={`Status for report ${report.id}`}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </form>
      <form action={removeReport}>
        <input type="hidden" name="id" value={report.id} />
        <button type="submit">Delete</button>
      </form>
    </span>
  );
}
