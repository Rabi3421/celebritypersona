import type { NextConfig } from "next";
import { devDatabaseProblem } from "./lib/db-guard";
import { storedRedirects } from "./lib/stored-redirects";

// `next dev` must never run against the production database. Next has loaded
// the .env files by the time this runs, so the check sees what the app would.
const databaseProblem = devDatabaseProblem();
if (databaseProblem) {
  // Printed and stopped rather than thrown, so the message is not buried
  // under a stack trace.
  console.error(databaseProblem);
  process.exit(1);
}

const firebaseBucket =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "celebritypersona-918fc.firebasestorage.app";

const nextConfig: NextConfig = {
  // The version of the framework is not the visitor's business, and it is one
  // fewer thing telling a scanner what to try.
  poweredByHeader: false,

  // Every distinct (source, width, quality, format) the optimizer produces is
  // one transformation, and the Hobby plan's monthly allowance is small:
  // running out blocked the whole site for a month (Sep–Oct 2026). Everything
  // below is set to keep that count down — fewer variants per photo, and each
  // variant made once rather than again whenever its cache entry expires.
  images: {
    // WebP only. AVIF alongside it doubled the variants for every photo, and
    // uploads are already WebP, so the saving it bought was a few KB a photo.
    formats: ["image/webp"],

    // Four device widths instead of seven. A browser takes the smallest one at
    // least as wide as it needs, so a gap costs some bytes on some screens,
    // not sharpness. No source is wider than 2000px (new uploads stop there;
    // the home hero is 1672), so 1920 is the top that can ever matter.
    deviceSizes: [640, 828, 1200, 1920],

    // The fixed-size thumbnails and avatars (24–56px, at 1x and 2x) land on
    // 48 or 96; 256 serves the small grid tiles before 640 takes over.
    imageSizes: [48, 96, 256],

    // Required from Next 16; one quality means one variant per width.
    qualities: [75],

    // 31 days instead of 4 hours. Firebase download URLs carry a token and are
    // never rewritten in place — a new photo is a new URL — so a variant never
    // goes stale, and re-making it every 4 hours was spending the allowance on
    // copies of the same image.
    minimumCacheTTL: 2678400,
    remotePatterns: [
      // Firebase download URLs always carry ?alt=media&token=…, and the URL
      // form of this rule would forbid a query string, so spell it out and
      // scope the path to this bucket's objects.
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: `/v0/b/${firebaseBucket}/o/**`,
      },
      // Reel thumbnails used to be served straight off Instagram's rotating
      // scontent hosts, against signed URLs that expire in days. They are
      // mirrored into the bucket above by `npm run instagram:mirror` now, so
      // nothing the site renders points at Meta and neither host is allowed
      // here any more. See lib/instagram.ts.
    ],
  },

  /**
   * Sent on every response.
   *
   * None of these change how a page looks; they close the gaps a scanner
   * reports and that an SEO audit counts against the site — content-type
   * sniffing, referrer leakage to the merchants the affiliate links point at,
   * and the page being framed by someone else.
   */
  /** Every recorded slug move, answered before any page renders. See
   *  lib/stored-redirects.ts for why this is not left to the pages. */
  async redirects() {
    return storedRedirects();
  },

  async headers() {
    const isDevelopment = process.env.NODE_ENV === "development";
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'self'",
          "object-src 'none'",
          `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com`,
          "style-src 'self' 'unsafe-inline'",
          "font-src 'self' data:",
          "img-src 'self' data: blob: https://firebasestorage.googleapis.com",
          // Nothing is played on the page any more: reels link out to their
          // Instagram permalink rather than hotlinking the MP4, so no remote
          // media origin needs to be allowed at all.
          "media-src 'self' blob:",
          "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://firebasestorage.googleapis.com",
        ].join("; "),
      },
      ...(process.env.NODE_ENV === "production"
        ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
        : []),
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // The outbound redirector. robots.txt already keeps crawlers out;
        // this covers anything that follows a link without reading it.
        source: "/go/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
