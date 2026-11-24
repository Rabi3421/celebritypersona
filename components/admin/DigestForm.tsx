"use client";

import { useActionState } from "react";
import { sendDigest, type AnnounceState } from "@/app/admin/(panel)/broadcasts/actions";
import styles from "@/app/admin/panel.module.css";

/**
 * This week's digest: the looks it will contain, listed before anything is
 * sent, and the same typed SEND as an announcement.
 */
export function DigestForm({
  looks,
  week,
  sent,
  audience,
}: {
  looks: { label: string; url: string }[];
  week: string;
  /** This week's digest already went out. */
  sent: boolean;
  audience: number;
}) {
  const [state, action, pending] = useActionState<AnnounceState, FormData>(sendDigest, {});

  return (
    <form action={action} id="digest-form" className={styles.section}>
      <div className={styles.sectionHead}>
        <h2>Weekly digest</h2>
        <span>{week} · every look published in the last 7 days, in one mail</span>
      </div>

      {state.error ? <p className={styles.bad}>{state.error}</p> : null}
      {state.queued ? <p className={styles.ok}>{state.queued}</p> : null}

      {sent ? (
        <p className={styles.muted}>This week&apos;s digest has gone out. The next one can be sent from Monday.</p>
      ) : looks.length === 0 ? (
        <p className={styles.muted}>No look was published in the last 7 days, so there is nothing to send yet.</p>
      ) : (
        <>
          <ol>
            {looks.map((look) => (
              <li key={look.url}>
                <a href={look.url} target="_blank" rel="noopener">
                  {look.label} ↗
                </a>
              </li>
            ))}
          </ol>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="digest-confirm">Type SEND to confirm</label>
              <input id="digest-confirm" name="confirm" autoComplete="off" placeholder="SEND" />
              <small>
                This writes to {audience} confirmed {audience === 1 ? "reader" : "readers"}. It cannot be recalled once a
                message has left.
              </small>
            </div>
          </div>
          <div className={styles.formBar}>
            <button className={styles.primary} type="submit" disabled={pending || audience === 0}>
              {pending ? "Sending…" : `Send ${looks.length === 1 ? "1 look" : `${looks.length} looks`} to ${audience} ${audience === 1 ? "reader" : "readers"}`}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
