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
 * The local-test flag ("1" or ""), honoured only off Vercel. Vercel sets
 * VERCEL=1 for every build and function, so even if CP_POSTHOG_LOCAL_TEST were
 * set there by mistake, real traffic could never be tagged as test traffic.
 */
export function localTestFlag(flag: string | undefined, vercel: string | undefined): "1" | "" {
  return flag === "1" && vercel !== "1" ? "1" : "";
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

/** Credentials in a URI: `scheme://user:password@host` (database URLs and the like). */
const URI_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/?#@"'<>]+@/gi;

/** `Bearer <token>` (Authorization headers echoed into an error). */
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

/** A JSON Web Token: three base64url segments, the first starting with `eyJ`. */
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

/** `name=value`, `name: value` or JSON `"name":"value"` where the name says the value is secret. */
const SECRET_ASSIGNMENT =
  /\b((?:access_|refresh_|id_|api_?|client_)?(?:token|secret|password|passwd|pwd|apikey|key|auth|authorization|session|sessionid|cookie|signature|sig|otp|credentials?))(["']?\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s&,;)"'}]+)/gi;

/** An absolute http(s) URL inside free text. */
const TEXT_URL = /\bhttps?:\/\/[^\s"'<>()]+/gi;

/** Any `scheme://…` URI inside free text (database and service URLs included). */
const TEXT_URI = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>()]+/gi;

/** A relative path with a query string inside free text: `/api/x?token=…`. */
const TEXT_PATH_QUERY = /(^|[\s"'(=])(\/[^\s?#"'()]*)\?[^\s"'()#]*/g;

export const REDACTED = "[redacted]";

/**
 * Secrets that never belong in analytics, removed from free text: credentials
 * in URIs, bearer tokens, JWTs, `token=`/`password:`-style assignments, and
 * email addresses. No URL parsing here (sanitizeUrl builds on this).
 */
function redactSecrets(text: string): string {
  return text
    .replace(URI_CREDENTIALS, `$1${REDACTED}@`)
    .replace(BEARER, `Bearer ${REDACTED}`)
    .replace(JWT, REDACTED)
    .replace(SECRET_ASSIGNMENT, `$1$2${REDACTED}`)
    .replace(EMAIL, REDACTED);
}

/**
 * Free text from the browser (messages, titles, stack traces): secrets removed,
 * and any URL inside it sanitized as sanitizeUrl does.
 */
export function redactText(text: string): string {
  return redactSecrets(text).replace(TEXT_URL, (url) => sanitizeUrl(url));
}

/**
 * Free text from the server (error messages, stacks): as redactText, and every
 * query string and fragment dropped outright, since a server error has no use
 * for them and they are where request values end up.
 */
export function redactServerText(text: string): string {
  return redactSecrets(text)
    .replace(TEXT_URI, (url) => stripQuery(url))
    .replace(TEXT_PATH_QUERY, (_match, before: string, path: string) => `${before}${path}`);
}

function stripQuery(url: string): string {
  return url.split(/[?#]/)[0];
}

/** Query values additionally lose phone numbers. */
function redactQueryValue(text: string): string {
  return redactSecrets(text).replace(PHONE, (match) => (match.replace(/\D/g, "").length >= 10 ? REDACTED : match));
}

/**
 * A URL with sensitive query values replaced, credentials and emails removed,
 * and its fragment dropped (a fragment can carry tokens and analytics never
 * needs it). Relative URLs stay relative. Anything that does not parse is
 * treated as text.
 */
export function sanitizeUrl(value: string): string {
  if (!value) return value;
  const base = "https://placeholder.invalid";
  const relative = !/^[a-z][a-z0-9+.-]*:/i.test(value);
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return redactSecrets(value);
  }
  url.username = "";
  url.password = "";
  for (const [name, raw] of [...url.searchParams.entries()]) {
    if (SENSITIVE_PARAM.test(name)) url.searchParams.set(name, REDACTED);
    else {
      const cleaned = redactQueryValue(raw);
      if (cleaned !== raw) url.searchParams.set(name, cleaned);
    }
  }
  url.hash = "";
  const decodedPath = safeDecode(url.pathname);
  if (redactSecrets(decodedPath) !== decodedPath) url.pathname = redactSecrets(decodedPath);
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
 * Event properties with every URL sanitized and secrets removed from any other
 * text, however deeply nested (exception stacks included). "server" mode also
 * drops every query string, from URL-valued keys and from free text alike.
 */
export function sanitizeProperties<T>(value: T, key = "", mode: "browser" | "server" = "browser"): T {
  if (typeof value === "string") {
    if (mode === "server") return (URL_KEY.test(key) ? redactSecrets(stripQuery(value)) : redactServerText(value)) as T;
    return (URL_KEY.test(key) ? sanitizeUrl(value) : redactText(value)) as T;
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeProperties(item, key, mode)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeProperties(v, k, mode);
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
