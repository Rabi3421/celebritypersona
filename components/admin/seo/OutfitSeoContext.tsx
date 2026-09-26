"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { readOutfitSnapshot, type OutfitSnapshot } from "@/lib/outfit-form-snapshot";
import type { KeywordOwner } from "@/lib/seo-checks";

type Value = {
  formId: string;
  snapshot: OutfitSnapshot | null;
  /** Other looks' keywords, for the cannibalisation warning. */
  owners: KeywordOwner[];
  outfitId?: number;
  /** Slugs in use elsewhere, so a suggestion never collides. */
  takenSlugs: string[];
};

const Context = createContext<Value | null>(null);

/**
 * Re-reads the outfit form whenever anything in it changes, and hands the
 * result to the SEO widgets below it.
 *
 * Typing fires `input`; selects and checkboxes fire `change`; the photo editor
 * and the piece rows change hidden inputs and add or remove elements, which
 * fire nothing, so a MutationObserver catches those. Reads are coalesced into
 * one per frame.
 *
 * The children are created by the parent, so a new snapshot re-renders only
 * the widgets that read it — not the form, whose inputs keep their own state.
 */
export function OutfitSeoProvider({
  formId,
  owners,
  outfitId,
  takenSlugs,
  children,
}: Omit<Value, "snapshot"> & { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<OutfitSnapshot | null>(null);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setSnapshot(readOutfitSnapshot(form)));
    };
    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    const observer = new MutationObserver(read);
    observer.observe(form, { subtree: true, childList: true, attributes: true, attributeFilter: ["value"] });
    return () => {
      cancelAnimationFrame(frame);
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
      observer.disconnect();
    };
  }, [formId]);

  return (
    <Context.Provider value={{ formId, snapshot, owners, outfitId, takenSlugs }}>
      {children}
    </Context.Provider>
  );
}

export function useOutfitSeo() {
  const value = useContext(Context);
  if (!value) throw new Error("useOutfitSeo must be used inside OutfitSeoProvider");
  return value;
}

/** Sets a form field as if it had been typed, so everything listening —
 *  including the snapshot — sees the change. */
export function fillField(formId: string, name: string, value: string) {
  const field = document
    .getElementById(formId)
    ?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
  if (!field) return;
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}
