/**
 * The two decisions behind OutfitSeoProvider's live form snapshot, kept apart
 * from React and the DOM so they can be tested on their own.
 *
 * Why they exist: the provider re-reads the outfit form whenever anything in
 * it changes — `input`/`change` events for typing, and a MutationObserver for
 * the hidden inputs and rows the photo editor and piece rows change without
 * firing events. Widgets that re-render on a new snapshot can write to the DOM
 * as they do: React 19 re-applies a <textarea>'s defaultValue on every render,
 * which replaces its text node. The observer saw that write, re-read the form,
 * published a new (identical) snapshot, which re-rendered the widget, which
 * wrote again — about sixty times a second on every look with a saved search
 * description, and any debounced work (the research pack fingerprint behind
 * "Import findings") never got to run.
 */

type NodeLike = { nodeName: string; parentNode?: NodeLike | null };
type RecordLike = { target: NodeLike };

/**
 * True when every change is to the text inside a <textarea> — what React does
 * when it re-applies a defaultValue. A person typing in a textarea fires
 * `input`, which the provider listens to separately, so nothing is missed.
 */
export function onlyTextareaText(records: readonly RecordLike[]): boolean {
  return records.length > 0 && records.every((r) => r.target.nodeName === "TEXTAREA" || r.target.parentNode?.nodeName === "TEXTAREA");
}

/**
 * Publishes a reading only when its content differs from the last one
 * published. An identical reading changes nothing a widget could show, so
 * skipping it hides no edit — and it is what stops a re-render loop.
 */
export function changeGate<T>(publish: (value: T) => void): (next: T) => boolean {
  let last: string | null = null;
  return (next) => {
    const json = JSON.stringify(next);
    if (json === last) return false;
    last = json;
    publish(next);
    return true;
  };
}
