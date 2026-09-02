"use client";

import { useActionState } from "react";
import { subscribe, type AudienceState } from "@/app/actions/audience";

/**
 * The mailing list.
 *
 * Nothing is sent to an address until somebody clicks the link in the
 * confirmation mail, so the copy promises the inbox step rather than pretending
 * the job is done. When the address looks mistyped the form says so once and
 * lets the reader overrule it — a suggestion, not a gate.
 */
export function Signup() {
  const [state, action, pending] = useActionState<AudienceState, FormData>(subscribe, {});

  const message = state.already
    ? "You were already on the list. Nothing more to do."
    : state.done
      ? "Check your inbox — tap the link in the mail and you're on the list."
      : "Two a week. The best decodes, the biggest price gaps. One tap unsubscribes.";

  return (
    <section className="sec" id="updates">
      <div className="signup rv">
        <div>
          <h2>New looks, straight to your inbox</h2>
          <p>{message}</p>
          {state.errors?.email || state.errors?.form ? (
            <p role="alert">{state.errors.email ?? state.errors.form}</p>
          ) : null}
        </div>
        {state.done ? null : (
          <form className="sform" action={action}>
            <input
              placeholder="you@example.com"
              aria-label="Email address"
              aria-invalid={state.errors?.email ? true : undefined}
              type="email"
              inputMode="email"
              autoComplete="email"
              name="email"
              defaultValue={state.suggestion}
              required
            />
            {/* Set once the reader has seen a spelling suggestion, so a second
                submit of the same address goes through unchallenged. */}
            <input type="hidden" name="confirmed" value={state.suggestion ? "yes" : ""} />
            {/* Invisible to a person, irresistible to a bot. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
            />
            <button className="btn btn-primary" type="submit" disabled={pending}>
              <span>{pending ? "Sending…" : state.suggestion ? "Use this address" : "Get updates"}</span>
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
