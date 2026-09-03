import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";
import { site, social } from "@/lib/site-config";

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
  authors: [{ name: "Rabi", url: `${siteUrl}/about` }],
  publisher: site.name,
  category: "Fashion",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteGraph) }}
        />
      </body>
    </html>
  );
}
