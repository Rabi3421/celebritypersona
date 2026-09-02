"use client";

import { useActionState } from "react";
import { announceOutfit, type AnnounceState } from "@/app/admin/(panel)/broadcasts/actions";
import styles from "@/app/admin/panel.module.css";

/**
 * Sending to the whole list, made deliberately slightly awkward.
 *
 * The reader count is stated in the button itself so nobody presses it without
 * seeing the size of what they are about to do, and the word has to be typed:
 * a checkbox is something you tick past on the way to somewhere else.
 */
export function AnnounceForm({
  outfits,
  audience,
}: {
  outfits: { id: number; label: string; slug: string }[];
  audience: number;
}) {
  const [state, action, pending] = useActionState<AnnounceState, FormData>(announceOutfit, {});

  if (outfits.length === 0) {
    return (
      <div className={styles.notice}>
        <strong>Every recent look has been announced</strong>
        <p>Publish a new one and it will appear here.</p>
      </div>
    );
  }

  return (
    <form action={action} id="announce-form" className={styles.section}>
      <div className={styles.sectionHead}>
        <h2>Announce a look</h2>
        <span>Queued, not sent — you can stop it below</span>
      </div>

      {state.error ? <p className={styles.bad}>{state.error}</p> : null}
      {state.queued ? <p className={styles.ok}>{state.queued}</p> : null}

      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label htmlFor="outfitId">Look</label>
          <select id="outfitId" name="outfitId" defaultValue={outfits[0]?.id}>
            {outfits.map((outfit) => (
              <option key={outfit.id} value={outfit.id}>
                {outfit.label}
              </option>
            ))}
          </select>
          <small>Only looks that have never been announced are listed.</small>
        </div>
        <div className={styles.field}>
          <label htmlFor="confirm">Type SEND to confirm</label>
          <input id="confirm" name="confirm" autoComplete="off" placeholder="SEND" />
          <small>
            This writes to {audience} confirmed {audience === 1 ? "reader" : "readers"}. It
            cannot be recalled once a message has left.
          </small>
        </div>
      </div>

      <div className={styles.formBar}>
        <button className={styles.primary} type="submit" disabled={pending || audience === 0}>
          {pending ? "Queueing…" : `Queue for ${audience} ${audience === 1 ? "reader" : "readers"}`}
        </button>
      </div>
    </form>
  );
}
