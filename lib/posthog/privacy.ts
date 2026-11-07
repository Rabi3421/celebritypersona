/**
 * What PostHog may see, decided in one place and shared by the browser and the
 * server. Pure functions with no imports, so they are unit-tested directly
 * (tests/posthog-privacy.test.mjs) and cannot drift between the two sides.
 */

/**
 * Whether PostHog runs at all: a project key, and either the Production
 * deployment or an explicit local test build. Preview deployments, `next dev`
 * and ordinary local builds never send anything.
 */
export function isPostHogEnabled(key: string | undefined, deployEnv: string | undefined, localTest: string | undefined): boolean {
  return (key ?? "").trim() !== "" && (deployEnv === "production" || localTest === "1");
}

/**
 * Never tracked: the panel, its API, and its sign-in page (which lives under
 * /admin). Errors from these paths are not reported either.
 */
export function isExcludedPath(pathname: string): boolean {
  return /^\/(?:api\/)?admin(?:\/|$)/.test(pathname);
}

/**
 * Query parameters whose value is replaced whatever it contains. Matched as a
 * whole word or a `_`/`-` separated part, so `access_token` and `user-email`
 * match but `design` and `author` do not.
 */
const SENSITIVE_PARAM =
  /(?:^|[_-])(?:token|e-?mail|mail|password|passwd|pwd|secret|auth|authorization|code|key|apikey|session|sessionid|sid|sig|signature|otp|phone|mobile|tel)(?:[_-]|$)/i;

/** An email address, plain or percent-encoded. */
const EMAIL = /[^\s@/?#&=,;:<>()[\]"']+(?:@|%40)[^\s@/?#&=,;:<>()[\]"']+\.[a-z]{2,}/gi;

/** A phone number in a query value: 10+ digits, optionally with + and separators. */
const PHONE = /\+?\d[\d\s().-]{8,}\d/g;

export const REDACTED = "[redacted]";

/** Replace email addresses inside free text (messages, titles, stack traces). */
export function redactText(text: string): string {
  return text.replace(EMAIL, REDACTED);
}

/** Query values additionally lose phone numbers. */
function redactQueryValue(text: string): string {
  return redactText(text).replace(PHONE, (match) => (match.replace(/\D/g, "").length >= 10 ? REDACTED : match));
}

/**
 * A URL with sensitive query values replaced, emails removed from the path, and
 * its fragment dropped (a fragment can carry tokens and analytics never needs
 * it). Relative URLs stay relative. Anything that does not parse is treated as
 * text.
 */
export function sanitizeUrl(value: string): string {
  if (!value) return value;
  const base = "https://placeholder.invalid";
  const relative = !/^[a-z][a-z0-9+.-]*:/i.test(value);
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return redactText(value);
  }
  for (const [name, raw] of [...url.searchParams.entries()]) {
    if (SENSITIVE_PARAM.test(name)) url.searchParams.set(name, REDACTED);
    else {
      const cleaned = redactQueryValue(raw);
      if (cleaned !== raw) url.searchParams.set(name, cleaned);
    }
  }
  url.hash = "";
  const decodedPath = safeDecode(url.pathname);
  if (redactText(decodedPath) !== decodedPath) url.pathname = redactText(decodedPath);
  const out = url.toString();
  return relative ? out.slice(base.length) : out;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Keys whose string values are URLs or paths. */
const URL_KEY = /url|referrer|href|pathname/i;

/**
 * Event properties with every URL sanitized and emails removed from any other
 * text, however deeply nested (exception stacks included).
 */
export function sanitizeProperties<T>(value: T, key = ""): T {
  if (typeof value === "string") return (URL_KEY.test(key) ? sanitizeUrl(value) : redactText(value)) as T;
  if (Array.isArray(value)) return value.map((item) => sanitizeProperties(item, key)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeProperties(v, k);
    return out as T;
  }
  return value;
}

/** The path of a URL or path string, for exclusion checks. */
export function pathOf(value: string | undefined | null): string {
  if (!value) return "";
  try {
    return new URL(value, "https://placeholder.invalid").pathname;
  } catch {
    return value.split(/[?#]/)[0];
  }
}

/**
 * Exceptions thrown entirely by browser extensions are noise: the site cannot
 * fix them and they would spend the monthly allowance.
 */
export function isExtensionNoise(properties: Record<string, unknown> | undefined): boolean {
  const list = properties?.$exception_list;
  if (!Array.isArray(list) || list.length === 0) return false;
  const files = list.flatMap((entry) => {
    const frames = (entry as { stacktrace?: { frames?: { filename?: string }[] } })?.stacktrace?.frames ?? [];
    return frames.map((frame) => frame.filename ?? "");
  });
  return files.length > 0 && files.every((file) => /^(?:chrome|moz|safari(?:-web)?)-extension:/.test(file));
}
