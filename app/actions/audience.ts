"use server";

import { headers } from "next/headers";
import { checkRateLimit, clientKey, recordFailure } from "@/lib/auth/rate-limit";
import { recordCelebrityRequest, recordSubscriber } from "@/lib/db/mutations";
import { text } from "@/lib/form-data";
import {
  celebrityRequestSchema,
  fieldErrors,
  subscriberSchema,
  suggestEmail,
  type FieldErrors,
} from "@/lib/validation";
import { confirmEmail } from "@/lib/mail/templates";
import { sendMail } from "@/lib/mail/transport";
import { site } from "@/lib/site-config";

/**
 * The two things a reader can ask us for: decode someone, or message me when
 * there is something new. Both used to be forms that set a flag in React state
 * and threw the answer away.
 */

export type AudienceState = {
  errors?: FieldErrors;
  done?: boolean;
  /** Set when the address was already confirmed, so the page can say so. */
  already?: boolean;
  /** A likely correction the reader can accept or overrule. */
  suggestion?: string;
};

/** Low enough to stop a script, high enough that nobody real notices. */
const LIMIT = { windowMs: 60 * 60 * 1000, max: 10 };

async function throttle(scope: string): Promise<string | null> {
  const key = `${scope}:${await clientKey(await headers())}`;
  const limit = checkRateLimit(key, LIMIT);
  if (!limit.ok) {
    return `That is a lot at once. Try again in ${limit.retryAfterMinutes} minute${
      limit.retryAfterMinutes === 1 ? "" : "s"
    }.`;
  }
  recordFailure(key, LIMIT);
  return null;
}

export async function requestCelebrity(
  _previous: AudienceState,
  form: FormData,
): Promise<AudienceState> {
  const throttled = await throttle("request");
  if (throttled) return { errors: { form: throttled } };

  const parsed = celebrityRequestSchema.safeParse({
    name: text(form, "name"),
    website: text(form, "website"),
  });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    // The honeypot is invisible, so tripping it means a bot. Say thank you and
    // write nothing.
    if (errors.website) return { done: true };
    return { errors };
  }

  await recordCelebrityRequest(parsed.data.name);
  return { done: true };
}

/** The exact promise made beside the button, stored with the address so we
 *  can show what was agreed to, not just that something was. */
const OPT_IN_WORDING =
  "Two a week. The best decodes, the biggest price gaps. One tap unsubscribes.";

export async function subscribe(
  _previous: AudienceState,
  form: FormData,
): Promise<AudienceState> {
  const throttled = await throttle("subscribe");
  if (throttled) return { errors: { form: throttled } };

  const raw = text(form, "email");
  const parsed = subscriberSchema.safeParse({
    email: raw,
    website: text(form, "website"),
  });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    if (errors.website) return { done: true };
    return { errors };
  }

  // A likely mistyped domain is worth one question rather than a silent bounce
  // — but only once, so a genuine address at an odd domain can still get in.
  const suggestion = suggestEmail(parsed.data.email);
  if (suggestion && text(form, "confirmed") !== "yes") {
    return { suggestion, errors: { email: `Did you mean ${suggestion}?` } };
  }

  const head = await headers();
  const { outcome, token } = await recordSubscriber(parsed.data.email, {
    source: "homepage",
    wording: OPT_IN_WORDING,
    at: new Date().toISOString(),
    ip: head.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  if (outcome === "already-active") return { done: true, already: true };
  // Throttled means a confirmation went out minutes ago. Say the same thing we
  // would otherwise: the reader's next step is their inbox either way.
  if (outcome === "throttled") return { done: true };

  const confirmUrl = `${site.url}/api/subscribe/confirm?token=${token}`;
  const mail = confirmEmail(confirmUrl);
  const sent = await sendMail({
    to: parsed.data.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });

  if (!sent.ok) {
    // A permanent failure here means the address does not exist. Say so rather
    // than leaving them waiting on a mail that will never arrive.
    return {
      errors: {
        email: sent.permanent
          ? "That address was refused by its mail server. Check it and try again."
          : "We could not send the confirmation just now. Try again in a minute.",
      },
    };
  }

  return { done: true };
}
