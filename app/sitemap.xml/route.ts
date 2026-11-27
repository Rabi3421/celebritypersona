import { sitemapEntries, sitemapXml } from "@/lib/sitemap";

/**
 * The sitemap, as a plain route handler rather than `app/sitemap.ts`.
 *
 * The metadata-route version carried `revalidate = 3600` and the build honoured
 * it, but Vercel published its output like a static file — `etag`,
 * `last-modified`, an `age` that only a deploy reset — and kept serving the
 * build-time body. Five looks published after the deploy were live on every
 * page and missing from the sitemap for days. `/llms.txt`, a route handler
 * with the same TTL reading the same data, regenerated the whole time; this
 * takes the same shape so it behaves the same way.
 *
 * The route-handler version then did the same in Nov 2026: neither the hourly
 * `revalidate` nor the revalidation on publish replaced the cached body, and
 * two published looks stayed out of the sitemap for over 18 hours.
 *
 * So it no longer uses that cache at all. It is built from the database on
 * request, and Vercel's CDN keeps a copy for at most 10 minutes (s-maxage),
 * serving the old copy for up to 10 more while it fetches a new one. A newly
 * published look is in the sitemap within about 10 minutes, whatever happens
 * to revalidation, at the cost of one small database read per 10 minutes.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(sitemapXml(await sitemapEntries()), {
    headers: {
      "content-type": "application/xml",
      "cache-control": "public, max-age=0, s-maxage=600, stale-while-revalidate=600",
    },
  });
}
