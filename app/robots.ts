import type { MetadataRoute } from "next";
import { site } from "@/lib/site-config";

/**
 * `site.url` now carries the www host, so `Host:` and the sitemap link name
 * the address that actually serves the site. Both used to name
 * celebritypersona.com, which 308-redirects — Google was being pointed at a
 * redirect for the sitemap itself.
 *
 * /search and /saved are deliberately NOT disallowed: they carry `noindex`,
 * and a crawler has to be able to fetch a page to read that.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The panel and its endpoints are behind a session anyway; keeping them
      // out of the crawl saves the redirect chase.
      disallow: ["/admin", "/admin/", "/api/"],
    },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
