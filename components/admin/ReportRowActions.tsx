"use client";

import { removeReport, updateReportStatus } from "@/app/admin/(panel)/reports/actions";
import { PRICE_REPORT_STATUSES, type PriceReport } from "@/lib/types";
import styles from "@/app/admin/panel.module.css";
import { ConfirmButton } from "./ConfirmButton";

/**
 * Changing the status submits immediately; there is nothing else to confirm.
 * Deleting is not undoable and loses the reader's words, so it asks first in
 * a modal.
 */
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
          {PRICE_REPORT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </form>
      <form action={removeReport}>
        <input type="hidden" name="id" value={report.id} />
        <ConfirmButton
          className={styles.rowDanger}
          title="Delete this report?"
          message="The reader's correction goes with it, and it cannot be recovered."
          ariaLabel={`Delete report ${report.id}`}
        >
          Delete
        </ConfirmButton>
      </form>
    </span>
  );
}
