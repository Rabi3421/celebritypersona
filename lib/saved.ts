"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Saved looks and followed archives, held in the visitor's own browser.
 *
 * There is no account on this site and no reason to invent one to remember a
 * heart, so nothing here touches the server: the list lives in localStorage,
 * is shared by every component through one module-level store, and syncs
 * across tabs. Each save button used to be its own `useState`, which meant a
 * heart forgot itself the moment you navigated.
 *
 * Every storage call is guarded. Private-mode Safari, a full quota and a
 * cleared profile all throw or return nothing, and none of them may break the
 * page: the store simply falls back to memory for the rest of the session.
 */

const STORAGE_KEYS = {
  looks: "cp.saved.looks",
  people: "cp.saved.people",
} as const;

export type SavedKind = keyof typeof STORAGE_KEYS;

/** Enough to be generous, low enough that a runaway loop cannot fill the quota. */
const MAX_ITEMS = 300;

/** One frozen empty array, so an untouched list keeps a stable identity across
 *  renders and `useSyncExternalStore` does not loop. */
const EMPTY: readonly string[] = Object.freeze([]);

const cache = new Map<SavedKind, readonly string[]>();
const listeners = new Set<() => void>();

const canUseStorage = () => typeof window !== "undefined";

function readStorage(kind: SavedKind): readonly string[] {
  if (!canUseStorage()) return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS[kind]);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    // Anything that is not a non-empty string was not written by us.
    const clean = [...new Set(parsed.filter((value): value is string => typeof value === "string" && value.length > 0))];
    return clean.length ? Object.freeze(clean.slice(0, MAX_ITEMS)) : EMPTY;
  } catch {
    // Unreadable storage or corrupt JSON. An empty list is the safe answer.
    return EMPTY;
  }
}

function writeStorage(kind: SavedKind, items: readonly string[]) {
  if (!canUseStorage()) return;
  try {
    if (items.length === 0) window.localStorage.removeItem(STORAGE_KEYS[kind]);
    else window.localStorage.setItem(STORAGE_KEYS[kind], JSON.stringify(items));
  } catch {
    // Quota or a blocked origin. The in-memory cache still holds the change,
    // so the page behaves correctly for the rest of this session.
  }
}

/** The cache is the source of truth once populated; storage is where it is
 *  persisted to and rehydrated from. */
function snapshot(kind: SavedKind): readonly string[] {
  if (!canUseStorage()) return EMPTY;
  const held = cache.get(kind);
  if (held) return held;
  const loaded = readStorage(kind);
  cache.set(kind, loaded);
  return loaded;
}

function emit() {
  for (const listener of listeners) listener();
}

function set(kind: SavedKind, next: readonly string[]) {
  const frozen = Object.freeze(next.slice(0, MAX_ITEMS));
  cache.set(kind, frozen.length ? frozen : EMPTY);
  writeStorage(kind, frozen);
  emit();
}

/** Another tab changed the list. Drop the cache so the next read reloads it. */
function onStorageEvent(event: StorageEvent) {
  const kind = (Object.keys(STORAGE_KEYS) as SavedKind[]).find(
    (key) => STORAGE_KEYS[key] === event.key,
  );
  // A null key means the whole store was cleared, which affects both lists.
  if (event.key === null) cache.clear();
  else if (kind) cache.delete(kind);
  else return;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && canUseStorage()) {
    window.addEventListener("storage", onStorageEvent);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && canUseStorage()) {
      window.removeEventListener("storage", onStorageEvent);
    }
  };
}

export type SavedList = {
  items: readonly string[];
  count: number;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  /**
   * False during the server render and the first client paint, when the list
   * is not yet known. Anything whose value would otherwise flicker — a badge,
   * a count, an empty state — should wait for this.
   */
  ready: boolean;
};

/**
 * Reads a saved list. Every caller shares one store, so hearting a look on a
 * card updates the header badge in the same paint.
 *
 * The server snapshot is always empty, which is what the prerendered HTML
 * shows; React swaps in the real list after hydration without a mismatch.
 */
export function useSavedList(kind: SavedKind): SavedList {
  const items = useSyncExternalStore(
    subscribe,
    () => snapshot(kind),
    () => EMPTY,
  );
  // Distinguishes "no saved looks" from "not read yet": on the server and
  // during hydration the snapshot is the frozen EMPTY, never a real list.
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const has = useCallback((id: string) => items.includes(id), [items]);

  const add = useCallback(
    (id: string) => {
      if (!id) return;
      const current = snapshot(kind);
      if (current.includes(id)) return;
      // Newest first, so a long list drops what was saved longest ago.
      set(kind, [id, ...current]);
    },
    [kind],
  );

  const remove = useCallback(
    (id: string) => {
      const current = snapshot(kind);
      if (!current.includes(id)) return;
      set(kind, current.filter((value) => value !== id));
    },
    [kind],
  );

  const toggle = useCallback(
    (id: string) => {
      if (!id) return;
      const current = snapshot(kind);
      set(
        kind,
        current.includes(id) ? current.filter((value) => value !== id) : [id, ...current],
      );
    },
    [kind],
  );

  const clear = useCallback(() => set(kind, EMPTY), [kind]);

  return { items, count: items.length, has, toggle, add, remove, clear, ready };
}
