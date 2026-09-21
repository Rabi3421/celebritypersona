import { indexNowKey } from "@/lib/indexnow";

/**
 * Proof that whoever is submitting URLs for this host controls this host.
 *
 * The IndexNow endpoint fetches this file and checks that its contents match
 * the key in the submission. Without it every ping is rejected, which is the
 * point: otherwise anyone could ask Bing to recrawl anyone.
 *
 * Served from a route rather than dropped in public/ because the key is an
 * environment variable, not something to commit. A deployment without one
 * answers 404, which is the honest response — there is no key to prove.
 */

/** Read at request time. A build without the variable set must not bake a 404
 *  into a deployment that has one. */
export const dynamic = "force-dynamic";

export function GET() {
  const key = indexNowKey();
  if (!key) return new Response("Not found", { status: 404 });

  return new Response(key, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // The engines re-fetch this on every submission. It changes only when
      // the key is rotated, which is roughly never.
      "cache-control": "public, max-age=86400",
    },
  });
}
