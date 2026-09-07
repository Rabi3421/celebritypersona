"use client";

import styles from "@/app/admin/panel.module.css";
import { ConfirmButton } from "./ConfirmButton";

/**
 * The delete that lives in a list row, next to Edit and View.
 *
 * Deleting from the row saves opening the record only to delete it, so it
 * asks first, in the same modal the record's own form uses. `returnTo` sends
 * the admin back to the page and filters they were working through, rather
 * than to an unfiltered page one.
 */
export function DeleteRowButton({
  id,
  title,
  confirm,
  label,
  returnTo,
  action,
}: {
  id: number | string;
  /** The dialog heading — short, e.g. "Delete this look?". */
  title: string;
  confirm: string;
  /** Names the row for the screen reader, since "Delete" alone repeats. */
  label: string;
  returnTo?: string;
  action: (form: FormData) => Promise<void>;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <ConfirmButton
        className={styles.rowDanger}
        title={title}
        message={confirm}
        ariaLabel={`Delete ${label}`}
      >
        Delete
      </ConfirmButton>
    </form>
  );
}
