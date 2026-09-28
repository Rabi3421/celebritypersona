"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Keeps a copy of a form in this browser's local storage as it is edited, so a
 * reload, a crash or a closed tab does not cost the work.
 *
 * What is saved is exactly what the form would post — every field, the piece
 * rows, the photos' URLs and alt text, the hidden inputs the photo editor and
 * pickers maintain — so restoring is re-reading it the way the save action
 * would. Nothing is saved until someone actually edits; opening a form and
 * leaving it does not leave a draft behind.
 *
 * Local storage can be missing or refuse writes (private windows, full
 * storage); every access is guarded, and the form works the same without it.
 */

type Stored = { savedAt: number; entries: [string, string][] };

const read = (key: string): Stored | null => {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as Stored) : null;
    return parsed && Array.isArray(parsed.entries) ? parsed : null;
  } catch {
    return null;
  }
};

export const clearStoredDraft = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to clear, or storage is unavailable.
  }
};

/**
 * The draft that was waiting when the form opened, read once per visit. The
 * autosave keeps writing as the editor types, and none of that should turn
 * into a "restore?" offer mid-edit — only what was there on arrival.
 */
const onArrival = new Map<string, number | null>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useFormAutosave(formId: string, key: string) {
  const savedAt = useSyncExternalStore(
    subscribe,
    () => {
      if (!onArrival.has(key)) onArrival.set(key, read(key)?.savedAt ?? null);
      return onArrival.get(key) ?? null;
    },
    // The server has no local storage; the offer appears once hydrated.
    () => null,
  );
  const offer = savedAt === null ? null : { savedAt };
  const setOffer = useCallback(
    (value: null) => {
      onArrival.set(key, value);
      notify();
    },
    [key],
  );
  /** Edited since the last successful save, so leaving would lose something. */
  const dirty = useRef(false);
  const submitting = useRef(false);

  // Leaving the form forgets what was read on arrival, so the next visit
  // reads again.
  useEffect(() => () => void onArrival.delete(key), [key]);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    let timer = 0;
    const save = () => {
      if (!dirty.current) return;
      const entries = [...new FormData(form).entries()].filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      );
      try {
        window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), entries } satisfies Stored));
      } catch {
        // Storage full or unavailable: the form still works, just without a net.
      }
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(save, 700);
    };
    const edited = () => {
      dirty.current = true;
      submitting.current = false;
      schedule();
    };
    // The photo editor and the pickers change hidden inputs, which fire no
    // events; once someone has edited, those changes are saved too.
    const observer = new MutationObserver(() => {
      if (dirty.current) schedule();
    });
    const onSubmit = () => {
      submitting.current = true;
    };
    const onLeave = (event: BeforeUnloadEvent) => {
      if (dirty.current && !submitting.current) event.preventDefault();
    };

    form.addEventListener("input", edited);
    form.addEventListener("change", edited);
    form.addEventListener("submit", onSubmit);
    observer.observe(form, { subtree: true, childList: true, attributes: true, attributeFilter: ["value"] });
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.clearTimeout(timer);
      form.removeEventListener("input", edited);
      form.removeEventListener("change", edited);
      form.removeEventListener("submit", onSubmit);
      observer.disconnect();
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [formId, key]);

  /** The saved draft as FormData, for the form to read back; clears the offer. */
  const restore = useCallback((): FormData | null => {
    const stored = read(key);
    setOffer(null);
    if (!stored) return null;
    const data = new FormData();
    for (const [name, value] of stored.entries) data.append(name, value);
    dirty.current = true;
    return data;
  }, [key, setOffer]);

  /** Throws the saved draft away. */
  const discard = useCallback(() => {
    clearStoredDraft(key);
    setOffer(null);
  }, [key, setOffer]);

  /** After a successful save: nothing is unsaved any more. */
  const saved = useCallback(() => {
    clearStoredDraft(key);
    dirty.current = false;
    setOffer(null);
  }, [key, setOffer]);

  return { offer, restore, discard, saved };
}
