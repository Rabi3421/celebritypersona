import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

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

/** Set NEXT_PUBLIC_SITE_URL in the deploy environment. Canonical and Open
 *  Graph URLs resolve against it. */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://celebritypersona.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default:
      "CelebrityPersona — What Indian celebrities wear, and where to get the look",
    template: "%s · CelebrityPersona",
  },
  description:
    "Discover Indian celebrity outfits, occasion edits, trending style, identified pieces, and accessible ways to make every look your own.",
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
      name: "CelebrityPersona",
      url: siteUrl,
      description:
        "What Indian celebrities wear, decoded piece by piece, with prices and affordable swaps.",
      logo: {
        "@type": "ImageObject",
        "@id": `${siteUrl}#logo`,
        url: `${siteUrl}/brand/celebritypersona-logo.png`,
        caption: "CelebrityPersona",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}#website`,
      url: siteUrl,
      name: "CelebrityPersona",
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
