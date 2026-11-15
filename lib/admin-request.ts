/** Additional protection for cookie-authenticated browser mutations.
 * Next.js also checks Server Action Origin/Host before dispatching the action.
 */
export function isSameOriginAdminRequest(headers: Pick<Headers, "get">): boolean {
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!origin || !host || headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    const url = new URL(origin);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && url.origin === origin && url.host === host;
  } catch { return false; }
}
