import styles from "@/app/admin/panel.module.css";
import { MIN_INTRO_WORDS, type hubSearchStatus } from "@/lib/indexing";

/**
 * A hub's standing with search engines, in the admin lists: whether its page
 * asks to be indexed, and when it does not for want of an intro, how far the
 * intro is from the length that would put it back — so an editor knows where
 * to write first.
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
