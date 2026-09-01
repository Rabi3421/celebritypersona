"use server";

import { headers } from "next/headers";
import { checkRateLimit, clientKey, recordFailure } from "@/lib/auth/rate-limit";
import { recordCelebrityRequest, recordSubscriber } from "@/lib/db/mutations";
import { text } from "@/lib/form-data";
import {
  celebrityRequestSchema,
  fieldErrors,
  subscriberSchema,
  type FieldErrors,
} from "@/lib/validation";

/**
 * The two things a reader can ask us for: decode someone, or message me when
 * there is something new. Both used to be forms that set a flag in React state
 * and threw the answer away.
 */

export type AudienceState = { errors?: FieldErrors; done?: boolean };

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

export async function subscribe(
  _previous: AudienceState,
  form: FormData,
): Promise<AudienceState> {
  const throttled = await throttle("subscribe");
  if (throttled) return { errors: { form: throttled } };

  const parsed = subscriberSchema.safeParse({
    number: text(form, "number"),
    website: text(form, "website"),
  });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    if (errors.website) return { done: true };
    return { errors };
  }

  await recordSubscriber(parsed.data.number);
  return { done: true };
}
