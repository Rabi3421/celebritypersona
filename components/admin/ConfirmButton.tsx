"use client";

import { useEffect, useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import styles from "@/app/admin/panel.module.css";

/**
 * A submit button that asks in a modal before it lets the form go.
 *
 * Replaces `window.confirm`, which drops a browser-chrome alert on top of a
 * dark panel and cannot say which row it is about in the admin's own voice.
 * Built on <dialog showModal()>, so focus trapping, Esc and the backdrop are
 * the platform's job rather than ours.
 *
 * The real submit stays a plain form post: the dialog's confirm calls
 * requestSubmit() on the surrounding form, so the server action runs exactly
 * as it would have without any of this.
 *
 * The dialog stays open while the action runs, showing a spinner where the
 * confirm button was. A delete reaches the database and then redirects, which
 * is long enough on a slow connection to look like nothing happened.
 */
export function ConfirmButton({
  children,
  className,
  title,
  message,
  confirmLabel = "Delete",
  pendingLabel = "Deleting…",
  ariaLabel,
}: {
  /** The label on the button that opens the dialog. */
  children: React.ReactNode;
  className?: string;
  title: string;
  message: string;
  confirmLabel?: string;
  /** Replaces the confirm label while the action is in flight. */
  pendingLabel?: string;
  /** Names the row for a screen reader where the label alone repeats. */
  ariaLabel?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  // A dialog left open across a hot reload or a route change would outlive the
  // row it belongs to.
  useEffect(() => () => dialog.current?.close(), []);

  // A delete redirects, so the usual end of this is the whole page unmounting.
  // An action that finishes in place instead — a validation failure, a lost
  // connection — would otherwise leave the dialog stuck on its spinner.
  useEffect(() => {
    if (wasPending.current && !pending) dialog.current?.close();
    wasPending.current = pending;
  }, [pending]);

  return (
    <>
      <button
        ref={opener}
        type="button"
        className={className}
        aria-label={ariaLabel}
        disabled={pending}
        onClick={() => dialog.current?.showModal()}
      >
        {children}
      </button>

      <dialog
        ref={dialog}
        className={styles.confirm}
        aria-labelledby={titleId}
        aria-busy={pending}
        // Esc reaches a dialog even mid-submit, and closing then would hide a
        // delete that is already on its way.
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <h2 className={styles.confirmTitle} id={titleId}>
          {title}
        </h2>
        <p className={styles.confirmBody}>{message}</p>
        <div className={styles.confirmBar}>
          <button
            type="button"
            className={styles.confirmCancel}
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.confirmGo}
            disabled={pending}
            onClick={() => opener.current?.form?.requestSubmit()}
          >
            {pending ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                <span role="status">{pendingLabel}</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </dialog>
    </>
  );
}
