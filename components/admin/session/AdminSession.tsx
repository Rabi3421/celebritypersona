"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { signInInPlace } from "@/app/admin/login/actions";
import styles from "@/app/admin/panel.module.css";

/**
 * Keeps the admin session alive while an editor works, and recovers in place
 * when it has run out anyway — without leaving the page, so nothing typed into
 * a form is lost.
 *
 *  - Heartbeat: while the tab is visible and someone has typed or clicked
 *    recently, the session is checked (and so renewed) every few minutes. A
 *    long stretch on one form is activity, not idleness.
 *  - Coming back to the tab checks at once, and asks for the password then,
 *    rather than letting the page look signed in until the next save fails.
 *  - Every form in the panel is checked just before it posts. If the session
 *    is gone, the post waits behind a sign-in prompt and goes ahead after it.
 *  - `adminFetch` retries a refused request once after a silent renew, then
 *    after the prompt. The upload uses it.
 */

type Value = {
  /** Resolves true once signed in (at once if already), false if cancelled.
   *  `force` skips the recent-check shortcut: for when the server has just
   *  said the session is gone. */
  ensureSignedIn: (options?: { force?: boolean }) => Promise<boolean>;
  /** fetch() for /api/admin routes, recovering from an expired session. */
  adminFetch: (input: string, init?: RequestInit) => Promise<Response>;
};

const Context = createContext<Value | null>(null);

const SESSION_URL = "/api/admin/session";

/** Whether the server still recognises the session; a live one is renewed. */
async function checkSession(): Promise<boolean> {
  try {
    const response = await fetch(SESSION_URL, { cache: "no-store", credentials: "same-origin" });
    return response.ok;
  } catch {
    // Offline or the server is down: not evidence of being signed out.
    return true;
  }
}

export function AdminSession({
  email,
  heartbeatSeconds,
  children,
}: {
  email: string;
  heartbeatSeconds: number;
  children: ReactNode;
}) {
  const [prompting, setPrompting] = useState(false);
  const waiters = useRef<((ok: boolean) => void)[]>([]);
  const lastActivity = useRef(0);
  /** When the server last confirmed the session, so a burst of saves does
   *  not check it once per click. The page itself was just rendered for a
   *  signed-in session, so it starts confirmed. */
  const confirmedAt = useRef(0);
  useEffect(() => {
    lastActivity.current = Date.now();
    confirmedAt.current = Date.now();
  }, []);

  const settle = useCallback((ok: boolean) => {
    setPrompting(false);
    if (ok) confirmedAt.current = Date.now();
    for (const resolve of waiters.current.splice(0)) resolve(ok);
  }, []);

  const ensureSignedIn = useCallback(async (options?: { force?: boolean }) => {
    if (options?.force) confirmedAt.current = 0;
    if (Date.now() - confirmedAt.current < 30_000) return true;
    if (await checkSession()) {
      confirmedAt.current = Date.now();
      return true;
    }
    return new Promise<boolean>((resolve) => {
      waiters.current.push(resolve);
      setPrompting(true);
    });
  }, []);

  const adminFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      const first = await fetch(input, init);
      if (first.status !== 401) return first;
      // One silent renew — enough when another tab has signed in again.
      if (await checkSession()) return fetch(input, init);
      return (await ensureSignedIn({ force: true })) ? fetch(input, init) : first;
    },
    [ensureSignedIn],
  );

  // Heartbeat, and a check whenever the tab comes back into view.
  useEffect(() => {
    const note = () => {
      lastActivity.current = Date.now();
    };
    const events = ["keydown", "pointerdown", "input", "wheel"] as const;
    events.forEach((name) => window.addEventListener(name, note, { passive: true }));

    const beat = async () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActivity.current > heartbeatSeconds * 1000) return;
      if (await checkSession()) confirmedAt.current = Date.now();
      else setPrompting(true);
    };
    const timer = window.setInterval(beat, heartbeatSeconds * 1000);

    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      if (await checkSession()) confirmedAt.current = Date.now();
      else setPrompting(true);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      events.forEach((name) => window.removeEventListener(name, note));
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [heartbeatSeconds]);

  // Every form in the panel checks the session just before it posts.
  useEffect(() => {
    const cleared = new WeakSet<HTMLFormElement>();
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.dataset.sessionGuard === "off") return;
      if (cleared.has(form)) {
        cleared.delete(form);
        return;
      }
      // Recently confirmed: let it through without a round trip.
      if (Date.now() - confirmedAt.current < 30_000) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      const submitter = event.submitter instanceof HTMLElement ? event.submitter : null;
      void ensureSignedIn().then((ok) => {
        if (!ok || !form.isConnected) return;
        cleared.add(form);
        form.requestSubmit(submitter as HTMLButtonElement | null);
      });
    };
    // Capture, so it runs before React's own submit handling.
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, [ensureSignedIn]);

  return (
    <Context.Provider value={{ ensureSignedIn, adminFetch }}>
      {children}
      {prompting ? <SignInPrompt email={email} onDone={settle} /> : null}
    </Context.Provider>
  );
}

export function useAdminSession() {
  const value = useContext(Context);
  if (!value) throw new Error("useAdminSession must be used inside AdminSession");
  return value;
}

/**
 * For a form whose action came back "session expired" — the rare case where
 * the session ran out between the check and the save. Asks for the password,
 * then posts the form again; the action has already echoed the typed values
 * back into it.
 */
export function useRetryAfterSignIn(state: { sessionExpired?: boolean } | undefined, formId: string) {
  const { ensureSignedIn } = useAdminSession();
  useEffect(() => {
    if (!state?.sessionExpired) return;
    let live = true;
    // Forced: the server has just said the session is gone, whatever the
    // last check said, and trusting that check would resubmit into the same
    // refusal again and again.
    void ensureSignedIn({ force: true }).then((ok) => {
      const form = document.getElementById(formId);
      if (live && ok && form instanceof HTMLFormElement) form.requestSubmit();
    });
    return () => {
      live = false;
    };
  }, [state, formId, ensureSignedIn]);
}

/** The password prompt, over the page, which stays exactly as it was. */
function SignInPrompt({ email, onDone }: { email: string; onDone: (ok: boolean) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => passwordRef.current?.focus(), []);

  return (
    <div className={styles.promptBackdrop} role="presentation">
      <div className={styles.prompt} role="dialog" aria-modal="true" aria-labelledby="session-prompt-title">
        <h2 id="session-prompt-title">Your session expired</h2>
        <p>Sign in to carry on. This page stays as it is — nothing you have typed or uploaded is lost.</p>
        <form
          data-session-guard="off"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError(null);
            const result = await signInInPlace(new FormData(event.currentTarget));
            setBusy(false);
            if (result.ok) onDone(true);
            else setError(result.error ?? "Could not sign in.");
          }}
        >
          <label>
            <span>Email</span>
            <input name="email" type="email" defaultValue={email} autoComplete="username" required />
          </label>
          <label>
            <span>Password</span>
            <input ref={passwordRef} name="password" type="password" autoComplete="current-password" required />
          </label>
          {error ? <p className={styles.bad}>{error}</p> : null}
          <div className={styles.promptBar}>
            <button type="submit" className={styles.saveButton} disabled={busy}>
              {busy ? "Signing in…" : "Sign in and continue"}
            </button>
            <button type="button" className={styles.ghost} onClick={() => onDone(false)}>
              Not now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
