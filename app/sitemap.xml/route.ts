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
 * An hour, matching every other archive route. Publishing in the panel
 * revalidates it immediately (see lib/revalidation.ts); the maintenance scripts
 * do it through /api/revalidate.
 */
export const revalidate = 3600;

export async function GET() {
  return new Response(sitemapXml(await sitemapEntries()), {
    headers: {
      "content-type": "application/xml",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
