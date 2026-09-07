"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import styles from "@/app/admin/panel.module.css";

/**
 * Corrects a name everywhere the archive uses it.
 *
 * Celebrity and occasion are typed onto each look, so a misspelling is not one
 * field to fix but every look carrying it — and for a name no record covers,
 * there was no form to fix it in at all. Typing a name that already exists
 * merges the two, which is the only way to repair an archive that has already
 * forked.
 */
function Fields({
  from,
  options,
  returnTo,
  noun,
}: {
  from: string;
  options: readonly string[];
  returnTo?: string;
  noun: string;
}) {
  const { pending } = useFormStatus();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const inputId = useId();
  const listId = useId();
  const [submitting, setSubmitting] = useState(false);
  const busy = submitting || pending;
  const wasPending = useRef(false);

  useEffect(() => () => dialog.current?.close(), []);

  useEffect(() => {
    if (wasPending.current && !pending) {
      setSubmitting(false);
      dialog.current?.close();
    }
    wasPending.current = pending;
  }, [pending]);

  return (
    <>
      <input type="hidden" name="from" value={from} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

      <button
        type="button"
        className={styles.rowDanger}
        aria-label={`Rename ${from}`}
        disabled={busy}
        onClick={() => dialog.current?.showModal()}
      >
        Rename
      </button>

      <dialog
        ref={dialog}
        className={styles.confirm}
        aria-labelledby={titleId}
        aria-busy={busy}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <h2 className={styles.confirmTitle} id={titleId}>
          Rename {from}
        </h2>
        <p className={styles.confirmBody}>
          Every look filed under this name moves with it, and the old URL
          redirects to the new one. Typing a name that already exists merges the
          two — this {noun}&rsquo;s own record is removed and its looks join the
          other.
        </p>

        <div className={styles.renameField}>
          <label htmlFor={inputId}>New name</label>
          <input
            id={inputId}
            name="to"
            defaultValue={from}
            list={listId}
            autoComplete="off"
            required
            disabled={busy}
          />
          <datalist id={listId}>
            {options
              .filter((option) => option !== from)
              .map((option) => (
                <option value={option} key={option} />
              ))}
          </datalist>
        </div>

        <div className={styles.confirmBar}>
          <button
            type="button"
            className={styles.confirmCancel}
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.confirmGo}
            disabled={busy}
            onClick={() => setSubmitting(true)}
          >
            {busy ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                <span role="status">Renaming…</span>
              </>
            ) : (
              "Rename"
            )}
          </button>
        </div>
      </dialog>
    </>
  );
}

export function RenameRowButton({
  from,
  options,
  returnTo,
  noun,
  action,
}: {
  from: string;
  /** The names already in use, offered so a merge is a pick rather than a
   *  retype that has to match exactly. */
  options: readonly string[];
  returnTo?: string;
  /** "celebrity" or "occasion", for the sentence in the dialog. */
  noun: string;
  action: (form: FormData) => Promise<void>;
}) {
  return (
    <form action={action}>
      <Fields from={from} options={options} returnTo={returnTo} noun={noun} />
    </form>
  );
}
