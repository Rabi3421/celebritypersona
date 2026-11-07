import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { Analytics } from "@/components/site/Analytics";
import { ConsentBanner } from "@/components/site/ConsentBanner";
import { NavProgress } from "@/components/site/NavProgress";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";
import { author, site, social } from "@/lib/site-config";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

const siteUrl = site.url;

/**
 * Site-wide defaults. Everything here is inherited by any route that does not
 * set its own, so the fallback share card and the locale are correct even on a
 * page nobody has written metadata for.
 *
 * `alternates.canonical` is deliberately NOT set here: it is not resolved
 * per-route, so a canonical declared at the root would tell Google that every
 * page on the site is the homepage. Each route declares its own through
 * `pageMetadata()` in lib/seo.ts.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default:
      "Indian Celebrity Outfits, Prices & Affordable Alternatives | CelebrityPersona",
    template: "%s · CelebrityPersona",
  },
  description:
    "What Indian celebrities actually wore, decoded piece by piece — the exact brands, the prices we could confirm, and affordable alternatives you can buy in India.",
  applicationName: site.name,
  authors: [{ name: author.name, url: `${siteUrl}${author.path}` }],
  publisher: site.name,
  category: "Fashion",
  /**
   * Search Console and Bing Webmaster Tools, by meta tag.
   *
   * Both offer a verification file, a DNS record or a meta tag; the tag is the
   * only one that survives a redeploy without anybody remembering to copy a
   * file into public/. Set the value in the deploy environment and it appears;
   * leave it unset and no empty tag is emitted.
   *
   * Neither adds a script to the page. Verification is a string a crawler
   * reads once — there is nothing to execute, and nothing about a reader is
   * sent anywhere.
   */
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : {}),
    ...(process.env.BING_SITE_VERIFICATION
      ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } }
      : {}),
  },
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: "en_IN",
    url: siteUrl,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [DEFAULT_OG_IMAGE.url] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbf9f5",
};

/**
 * Who the site is, said once for the whole site. Every page's own graph points
 * its publisher at this `@id`, so the organisation is described in one place
 * rather than restated — and the search box lets Google offer the site's own
 * search in a sitelinks result.
 */
const siteGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}#organization`,
      name: site.name,
      url: siteUrl,
      description:
        "What Indian celebrities wear, decoded piece by piece, with prices and affordable swaps.",
      logo: {
        "@type": "ImageObject",
        "@id": `${siteUrl}#logo`,
        url: `${siteUrl}/brand/celebritypersona-logo.png`,
        width: 1230,
        height: 252,
        caption: site.name,
      },
      sameAs: [social.instagram, social.youtube, social.pinterest],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}#website`,
      url: siteUrl,
      name: site.name,
      description: site.tagline,
      publisher: { "@id": `${siteUrl}#organization` },
      inLanguage: "en-IN",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${siteUrl}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

/**
 * Only a Production deployment reaches the live property. The measurement ID
 * is set for Preview as well as Production in Vercel, and a preview builds with
 * NODE_ENV=production, so NODE_ENV alone let preview visits into GA4.
 * VERCEL_ENV is "production" only for the production deployment; it is unset
 * locally, so `next dev` and local builds load nothing either.
 */
const gaId =
  process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production"
    ? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()
    : undefined;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        <NavProgress />
        {/* Before the page content in the DOM, so keyboard and screen-reader
            users reach the choice first; it is fixed to the bottom of the
            screen, so this changes nothing visually. Renders nothing unless
            this deployment has analytics to ask about. */}
        <ConsentBanner />
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteGraph) }}
        />
        {gaId ? <Analytics gaId={gaId} /> : null}
      </body>
    </html>
  );
}
