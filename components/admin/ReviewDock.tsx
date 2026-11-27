"use client";

import Link from "next/link";
import { useOptimistic, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import jobStyles from "@/components/admin/look-jobs.module.css";
import { publishFromPreview, toggleResearchCheck } from "@/app/admin/preview/[id]/actions";
import { LinkedText } from "@/components/admin/LinkedText";
import styles from "./review-dock.module.css";

export type DockCheck = { text: string; done: boolean; by?: string; at?: string };

type Props = {
  outfitId: number;
  jobId?: string;
  celebrity: string;
  event: string;
  live: boolean;
  checks: DockCheck[];
  /** Critical publishing rules that still fail, with what to do. */
  blocking: { label: string; detail?: string; href?: string }[];
  editHref: string;
  publicHref: string;
  share: { label: string; href: string; download?: boolean }[];
  notice: "published" | "notPublished" | null;
  by: string[];
  children: ReactNode;
};

const STORE = "cp:review-dock";
const EVENT = "cp:review-dock";

/** Whether the panel is open, remembered per browser; open when storage is unavailable. */
function readOpen() {
  try {
    return window.localStorage.getItem(STORE) !== "closed";
  } catch {
    return true;
  }
}
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
function setPanel(next: boolean) {
  try {
    window.localStorage.setItem(STORE, next ? "open" : "closed");
  } catch {
    // Not remembered; the toggle below still needs a value to read.
  }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * The editor's side of a draft's preview: what is left to confirm, what else
 * publishing needs, and the Publish button itself, beside the page as readers
 * will see it. On wide screens it sits to the right so the look stays in view
 * while each check is compared against it.
 */
export function ReviewDock(props: Props) {
  const { outfitId, jobId, celebrity, event, live, blocking, editHref, publicHref, share, notice, by, children } = props;
  const open = useSyncExternalStore(subscribe, readOpen, () => true);
  const [pending, startTransition] = useTransition();
  const [checks, setOptimistic] = useOptimistic(props.checks, (state, change: { text: string; done: boolean }) =>
    state.map((check) => (check.text === change.text ? { ...check, done: change.done, by: undefined, at: undefined } : check)),
  );

  const toggle = (check: DockCheck) => {
    if (!jobId) return;
    const form = new FormData();
    form.set("jobId", jobId);
    form.set("outfitId", String(outfitId));
    form.set("check", check.text);
    form.set("cleared", check.done ? "0" : "1");
    startTransition(async () => {
      setOptimistic({ text: check.text, done: !check.done });
      await toggleResearchCheck(form);
    });
  };

  const todo = checks.filter((check) => !check.done);
  const done = checks.filter((check) => check.done);
  const left = todo.length + blocking.length;
  const ready = left === 0;
  const percent = checks.length ? Math.round((done.length / checks.length) * 100) : 100;

  const publishButton = (big: boolean) =>
    live ? (
      <a className={`${styles.liveLink} ${big ? styles.big : ""}`} href={publicHref} target="_blank" rel="noreferrer">
        Live · view on site ↗
      </a>
    ) : (
      <form action={publishFromPreview} className={styles.publishForm}>
        <input type="hidden" name="id" value={outfitId} />
        <PublishSubmit
          className={`${styles.publish} ${big ? styles.big : ""}`}
          disabled={!ready || pending}
          title={ready ? "Publish this look on the site" : `${left} thing${left === 1 ? "" : "s"} left before it can go live`}
        >
          {ready ? "Publish" : `Publish · ${left} left`}
        </PublishSubmit>
      </form>
    );

  return (
    <div className={`${styles.shell} ${open ? styles.shellOpen : ""}`}>
      <header className={styles.bar}>
        <Link className={styles.back} href="/admin/outfits/from-links" aria-label="Back to the look queue">
          ←
        </Link>
        <div className={styles.who}>
          <strong>{celebrity}</strong>
          <span>{event}</span>
        </div>
        <span className={`${styles.state} ${live ? styles.stateLive : ""}`}>{live ? "Live" : "Draft"}</span>
        <div className={styles.barActions}>
          <details className={styles.menu}>
            <summary>Share images</summary>
            <div>
              {share.map((item) => (
                <a key={item.href} href={item.href} target={item.download ? undefined : "_blank"} rel="noreferrer">
                  {item.label}
                </a>
              ))}
            </div>
          </details>
          <a className={styles.edit} href={editHref}>
            Edit draft
          </a>
          {publishButton(false)}
          <button
            type="button"
            className={styles.panelToggle}
            aria-expanded={open}
            aria-controls="review-panel"
            onClick={() => setPanel(!open)}
          >
            <span className={styles.wide}>{open ? "Hide checklist" : left ? `Checklist · ${left}` : "Checklist ✓"}</span>
            <span className={styles.narrow}>{open ? "Hide" : left ? `Checks · ${left}` : "Checks ✓"}</span>
          </button>
        </div>
      </header>

      <aside id="review-panel" className={styles.panel} hidden={!open} aria-label="Review checklist">
        {notice === "published" ? (
          <p className={`${styles.notice} ${styles.noticeOk}`} role="status">
            Published. It is on the site now.{" "}
            <a href={publicHref} target="_blank" rel="noreferrer">
              Open the live page ↗
            </a>
          </p>
        ) : null}
        {notice === "notPublished" && !ready ? (
          <p className={`${styles.notice} ${styles.noticeBad}`} role="alert">
            Not published yet: finish what is listed below first.
          </p>
        ) : null}

        <div className={styles.summary}>
          <h2>{live ? "This look is live" : ready ? "Ready to publish" : "Before you publish"}</h2>
          {checks.length ? (
            <>
              <p>
                {done.length} of {checks.length} research checks confirmed
                {by.length ? ` · researched by ${by.map((name) => name.charAt(0).toUpperCase() + name.slice(1)).join(" + ")}` : ""}
              </p>
              <div className={styles.progress} aria-hidden="true">
                <span style={{ width: `${percent}%` }} />
              </div>
            </>
          ) : null}
        </div>

        {todo.length ? (
          <section className={styles.group} aria-labelledby="todo-title">
            <h3 id="todo-title">Confirm against the photo and links ({todo.length})</h3>
            <ul>
              {todo.map((check) => (
                <li key={check.text} className={styles.item}>
                  <button
                    type="button"
                    className={styles.tick}
                    aria-pressed={false}
                    aria-label="Mark as checked"
                    onClick={() => toggle(check)}
                  />
                  <p>
                    <LinkedText text={check.text} className={styles.inline} />
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {blocking.length ? (
          <section className={styles.group} aria-labelledby="needs-title">
            <h3 id="needs-title">Also needed to go live ({blocking.length})</h3>
            <ul>
              {blocking.map((item) => (
                <li key={item.label} className={`${styles.item} ${styles.need}`}>
                  <span className={styles.needMark} aria-hidden="true">!</span>
                  <p>
                    <strong>{item.label}</strong>
                    {item.detail ? <span> — {item.detail}</span> : null}{" "}
                    <a href={item.href ?? editHref} className={styles.fix}>
                      Fix in the editor →
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {done.length ? (
          <details className={styles.doneGroup} open>
            <summary>Confirmed ({done.length})</summary>
            <ul>
              {done.map((check) => (
                <li key={check.text} className={`${styles.item} ${styles.itemDone}`}>
                  <button
                    type="button"
                    className={`${styles.tick} ${styles.ticked}`}
                    aria-pressed={true}
                    aria-label="Undo: mark as not checked"
                    onClick={() => toggle(check)}
                  />
                  <p>
                    <LinkedText text={check.text} className={styles.inline} />
                    {check.by ? (
                      <small>
                        {check.by}
                        {check.at ? ` · ${check.at}` : ""}
                      </small>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <div className={styles.footer}>
          {publishButton(true)}
          <nav className={styles.footLinks} aria-label="More">
            <a href={editHref}>Edit draft</a>
            {share.map((item) => (
              <a key={item.href} href={item.href} target={item.download ? undefined : "_blank"} rel="noreferrer">
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      <div className={styles.page}>{children}</div>
    </div>
  );
}

/** The Publish button, with a visible "Publishing…" while the look goes live (no double clicks). */
function PublishSubmit({ className, disabled, title, children }: { className: string; disabled: boolean; title: string; children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={disabled || pending} title={title} aria-busy={pending || undefined}>
      {pending ? (
        <>
          <span className={jobStyles.spinner} aria-hidden="true" />
          Publishing…
        </>
      ) : (
        children
      )}
    </button>
  );
}
