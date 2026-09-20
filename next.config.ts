import type { NextConfig } from "next";

const firebaseBucket =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "celebritypersona-918fc.firebasestorage.app";

const nextConfig: NextConfig = {
  // The version of the framework is not the visitor's business, and it is one
  // fewer thing telling a scanner what to try.
  poweredByHeader: false,

  images: {
    remotePatterns: [
      // Firebase download URLs always carry ?alt=media&token=…, and the URL
      // form of this rule would forbid a query string, so spell it out and
      // scope the path to this bucket's objects.
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: `/v0/b/${firebaseBucket}/o/**`,
      },
      // Reel thumbnails. Instagram serves them from a rotating set of
      // scontent hosts, so the subdomain has to be a wildcard.
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
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
          "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://*.cdninstagram.com https://*.fbcdn.net",
          "media-src 'self' blob: https://*.cdninstagram.com https://*.fbcdn.net",
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
    ];
  },
};

export default nextConfig;
