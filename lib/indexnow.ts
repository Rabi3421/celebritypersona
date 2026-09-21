import "server-only";
import { site } from "@/lib/site-config";

/**
 * Telling Bing (and so Copilot, and so DuckDuckGo) that something changed,
 * instead of waiting to be asked.
 *
 * Google is not an IndexNow participant and ignores this entirely — its
 * freshness comes from the sitemap's `lastmod` and its own crawl schedule.
 * What this buys is the other half of the market: Bing, Yandex, Seznam and
 * Naver share one submission, and Bing's index is what Microsoft Copilot
 * answers from. For an archive whose value decays — a price checked last week,
 * a look worn last night — being crawled within minutes rather than within
 * days is the difference between being the source of an answer and being
 * absent from it.
 *
 * Deliberately quiet. A failure here is not a failure of the edit that
 * triggered it: the editor has saved their work, and a search engine being
 * briefly unreachable is not their problem. Every error is swallowed.
 */

/** Where the endpoint is told to look for the key. The file lives at a fixed
 *  path rather than the `<key>.txt` filename the protocol suggests, because
 *  the key is configuration and a route cannot be named after a value it does
 *  not know at build time. The protocol allows exactly this via `keyLocation`. */
const KEY_PATH = "/indexnow-key.txt";

/** One endpoint is enough. The participating engines share submissions between
 *  themselves, so pinging each of them separately is duplicated work. */
const ENDPOINT = "https://api.indexnow.org/indexnow";

/** The protocol's own ceiling for a single submission. The archive is nowhere
 *  near it, but a caller that grew a loop should be truncated, not rejected. */
const MAX_URLS = 10_000;

export const indexNowKey = () => process.env.INDEXNOW_KEY?.trim() || undefined;

/**
 * True only when a submission would be honest and useful.
 *
 * Preview deployments and local work resolve `site.url` to their own origin,
 * and submitting those tells the engines to crawl a host they cannot reach —
 * or worse, that the canonical host's content lives somewhere else. So the
 * ping is gated on running in production *and* on talking about the canonical
 * host, not on either alone.
 */
function shouldSubmit(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    site.url === `https://${site.host}` &&
    Boolean(indexNowKey())
  );
}

/**
 * Submits site-root-relative paths. Returns quietly whether or not anything
 * was sent; nothing downstream should branch on the outcome.
 *
 * Not awaited by callers — see `revalidateSite` in lib/db/mutations.ts. The
 * promise is still returned so a script or a test can wait for it.
 */
export async function pingIndexNow(paths: string[]): Promise<void> {
  const key = indexNowKey();
  if (!key || !shouldSubmit()) return;

  // A path submitted twice is a wasted line, and the caller assembles these
  // from several sources that legitimately overlap (an outfit edit touches the
  // look, her archive and the hubs).
  const urlList = [...new Set(paths)]
    .filter((path) => path.startsWith("/"))
    .slice(0, MAX_URLS)
    .map((path) => `${site.url}${path}`);
  if (!urlList.length) return;

  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: site.host,
        key,
        keyLocation: `${site.url}${KEY_PATH}`,
        urlList,
      }),
      // The editor is waiting on a redirect back to the panel. If the endpoint
      // is slow, we are not.
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Intentionally silent. See the note at the top of this file.
  }
}

/**
 * The pages that change whenever any published record changes.
 *
 * Every mutation moves the counts, the "latest decoded" rails and the budget
 * buckets, so these are always true to submit. A mutation that knows the
 * specific page it touched passes that as well.
 */
export const ARCHIVE_HUBS = [
  "/",
  "/outfits",
  "/celebrities",
  "/occasions",
  "/budget",
  "/trending",
];
