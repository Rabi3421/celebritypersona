import styles from "@/app/admin/panel.module.css";
import { MIN_INTRO_WORDS, type hubSearchStatus } from "@/lib/indexing";

/**
 * A hub's standing with search engines, in the admin lists: whether its page
 * asks to be indexed today, and whether it will stop once the thin-page rule
 * ships — so an editor knows where an intro is needed first.
 */
export function SearchCell({
  status,
  introWords,
}: {
  status: ReturnType<typeof hubSearchStatus>;
  introWords: number;
}) {
  return (
    <td>
      <span className={status.indexed ? undefined : styles.bad}>{status.label}</span>
      {status.needsIntro ? (
        <>
          {" "}
          <span
            className={`${styles.chip} ${styles.new}`}
            title={`Intro: ${introWords} of ${MIN_INTRO_WORDS} words`}
          >
            needs intro · {introWords}/{MIN_INTRO_WORDS}w
          </span>
        </>
      ) : null}
    </td>
  );
}
