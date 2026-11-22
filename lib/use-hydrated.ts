import { useSyncExternalStore } from "react";

const never = () => () => {};

/**
 * False while the server renders and while the browser takes over the page,
 * true afterwards. Text that depends on "today" ("Updated 3 days ago", a
 * countdown) must wait for it: a cached page was rendered on another day, and
 * React throws the whole page away when the two disagree (error #418).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(never, () => true, () => false);
}
