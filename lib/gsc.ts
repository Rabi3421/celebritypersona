import "server-only";
import { createSign } from "node:crypto";

/**
 * Read-only Google Search Console access with a service account
 * (GSC_SERVICE_ACCOUNT_JSON: the JSON key of gsc-reader@…, which has
 * "Restricted" permission on the property). No client library: a signed JWT
 * is exchanged for a one-hour token, then two REST endpoints are called.
 * Nothing here can change anything in Search Console.
 */

export const GSC_PROPERTY = "sc-domain:celebritypersona.com";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

export function serviceAccount(): ServiceAccount | null {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    return parsed.client_email && parsed.private_key ? parsed : null;
  } catch {
    return null;
  }
}

const b64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

export async function accessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = account.token_uri ?? "https://oauth2.googleapis.com/token";
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600 }),
  )}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key);
  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(signature)}` }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`token request failed (${response.status})`);
  return ((await response.json()) as { access_token: string }).access_token;
}

export type Inspection = { url: string; coverage: string; verdict: string; lastCrawl: string | null };

export async function inspectUrl(token: string, url: string): Promise<Inspection> {
  const response = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ inspectionUrl: url, siteUrl: GSC_PROPERTY }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`inspection failed (${response.status})`);
  const result = ((await response.json()) as { inspectionResult?: { indexStatusResult?: Record<string, string> } }).inspectionResult
    ?.indexStatusResult;
  return {
    url,
    coverage: result?.coverageState ?? "Unknown",
    verdict: result?.verdict ?? "VERDICT_UNSPECIFIED",
    lastCrawl: result?.lastCrawlTime?.slice(0, 10) ?? null,
  };
}

/** Search Analytics rows split by the given dimensions ("query", "page"). Web search only. */
export async function searchRows(token: string, startDate: string, endDate: string, dimensions: ("query" | "page")[], rowLimit = 1000) {
  const response = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_PROPERTY)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions, rowLimit, type: "web" }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) throw new Error(`search analytics failed (${response.status})`);
  return ((await response.json()) as { rows?: { keys: string[]; clicks: number; impressions: number; position: number }[] }).rows ?? [];
}

export async function searchTotals(token: string, startDate: string, endDate: string) {
  const response = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_PROPERTY)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ startDate, endDate }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) throw new Error(`search analytics failed (${response.status})`);
  const row = ((await response.json()) as { rows?: { clicks: number; impressions: number; position: number }[] }).rows?.[0];
  return { clicks: row?.clicks ?? 0, impressions: row?.impressions ?? 0, position: row ? Math.round(row.position * 10) / 10 : null };
}
