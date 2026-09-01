"use client";

import { useActionState } from "react";
import { subscribe, type AudienceState } from "@/app/actions/audience";

/**
 * The WhatsApp list. The form used to post to "#", so every number typed into
 * it was lost; it now stores the number against the panel's subscriber list.
 * We hold the number and nothing else, and the panel is where it is removed.
 */
export function Signup() {
  const [state, action, pending] = useActionState<AudienceState, FormData>(subscribe, {});

  return (
    <section className="sec" id="whatsapp">
      <div className="signup rv">
        <div>
          <h2>New looks, straight to WhatsApp</h2>
          <p>
            {state.done
              ? "You're on the list. Two messages a week, and one word stops them."
              : "Two messages a week. The best decodes, the biggest price gaps. Unsubscribe with one word."}
          </p>
          {state.errors?.number || state.errors?.form ? (
            <p role="alert">{state.errors.number ?? state.errors.form}</p>
          ) : null}
        </div>
        {state.done ? null : (
          <form className="sform" action={action}>
            <input
              placeholder="Your WhatsApp number"
              aria-label="WhatsApp number"
              aria-invalid={state.errors?.number ? true : undefined}
              inputMode="tel"
              name="number"
              required
            />
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
              <span>{pending ? "Adding…" : "Get updates"}</span>
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
