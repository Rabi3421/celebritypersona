"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** A navigation must outlast this before the bar appears, so the many pages
 *  that arrive straight away never flash it. */
const SHOW_AFTER = 140;
/** How long the finished bar holds at full width before it fades. */
const FADE_AFTER = 240;
/** Nothing should hold the bar open forever if a navigation never lands. */
const GIVE_UP_AFTER = 20_000;
const START_EVENT = "navprogress:start";

/**
 * Starts the bar for a navigation that never passes through an anchor — a
 * router.push() from a search box or a card. An event rather than a context so
 * a caller anywhere in the tree can reach it without a provider.
 */
export function startNavProgress() {
  window.dispatchEvent(new Event(START_EVENT));
}

/**
 * The site-wide navigation bar. Split out so the Suspense boundary below can
 * wrap the useSearchParams call: without one, every statically rendered page
 * that mounts this would fail the production build.
 */
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  const [shown, setShown] = useState(false);
  const [value, setValue] = useState(0);

  // The timers and the "is a navigation in flight" flag are refs, not state:
  // the listeners below are registered once and must read the live values.
  const running = useRef(false);
  const isShown = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const creep = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (creep.current) clearInterval(creep.current);
    creep.current = null;
  }, []);

  const hide = useCallback(() => {
    setShown(false);
    isShown.current = false;
    setValue(0);
  }, []);

  // start() gives up through this rather than depending on finish(), which is
  // defined below it and would make the two callbacks circular.
  const finishRef = useRef<() => void>(() => {});

  const start = useCallback(() => {
    if (running.current) return;
    running.current = true;
    clearTimers();

    timers.current.push(
      setTimeout(() => {
        setShown(true);
        isShown.current = true;
        setValue(8);
        // Creeps towards 90% and never reaches it: the bar cannot promise a
        // completion it has no way to measure, only that work is happening.
        creep.current = setInterval(
          () => setValue((v) => v + Math.max(0.5, (90 - v) * 0.08)),
          180,
        );
      }, SHOW_AFTER),
    );
    // A navigation that never lands would otherwise leave the bar creeping.
    timers.current.push(setTimeout(() => finishRef.current(), GIVE_UP_AFTER));
  }, [clearTimers]);

  const finish = useCallback(() => {
    if (!running.current) return;
    running.current = false;
    clearTimers();

    // A navigation that beat SHOW_AFTER never painted, so there is nothing to
    // run out — dropping it silently is the whole point of the delay.
    if (!isShown.current) {
      hide();
      return;
    }
    setValue(100);
    timers.current.push(setTimeout(hide, FADE_AFTER));
  }, [clearTimers, hide]);

  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  // The URL changes when the new route commits, which is the only honest
  // signal that the page the reader asked for is actually on screen.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    finish();
  }, [pathname, search, finish]);

  useEffect(() => {
    /** Everything that leaves the current page through an anchor. */
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin) return;
      // A link to where we already are, or to an anchor on this page, loads
      // nothing.
      if (next.pathname === window.location.pathname && next.search === window.location.search) {
        return;
      }

      start();
    };

    /**
     * The filter bars submit as plain GET forms, which the browser navigates
     * itself — no anchor is ever clicked. Only GET is watched: a POST form is
     * a server action, which React handles in place and which shows its own
     * pending state on the button that submitted it.
     */
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.method.toLowerCase() !== "get") return;
      if (new URL(form.action, window.location.href).origin !== window.location.origin) return;
      start();
    };

    // Capture, so it runs before Link's own handler calls preventDefault.
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("popstate", start);
    window.addEventListener(START_EVENT, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("popstate", start);
      window.removeEventListener(START_EVENT, start);
    };
  }, [start, finish]);

  useEffect(() => clearTimers, [clearTimers]);

  return (
    <div
      className="navload"
      aria-hidden="true"
      style={{ transform: `scaleX(${value / 100})`, opacity: shown ? 1 : 0 }}
    />
  );
}

/**
 * A thin bar across the top of every page while the next one is being fetched.
 *
 * Most of this site is a server render away — an outfit, a celebrity archive,
 * a filtered admin table — so a click can sit for a moment with nothing on
 * screen acknowledging it. Watching for anchor clicks means every link on the
 * site is covered, public and admin, without each one opting in; GET form
 * submits (the admin filter bars) are watched too, and the two places that
 * navigate in code call startNavProgress() instead.
 *
 * It is aria-hidden on purpose: Next announces route changes to screen readers
 * already, and a second live region would only talk over it.
 */
export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
