import type { Metadata } from "next";
// The visible questions live in, and are rendered by, HowWeWorkPage itself.
import { HowWeWorkPage } from "@/components/editorial/HowWeWorkPage";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";

export const metadata: Metadata = pageMetadata({
  title: "How We Decode a Celebrity Look",
  description: "The five steps behind every decode: sourcing the photo, identifying each piece by hand, pricing it, and finding an affordable alternative.",
  path: "/how-we-work",
});

const structuredData = jsonLd([
  {
    "@type": "WebPage",
    "@id": `${site.url}/how-we-work#page`,
    url: `${site.url}/how-we-work`,
    isPartOf: { "@id": `${site.url}#website` },
    inLanguage: "en-IN",
  },
  /*
   * No FAQPage markup — see the note on /trending. Google narrowed FAQ rich
   * results to well-known government and health sites in August 2023, so this
   * earned nothing while still having to be kept in step with the visible
   * questions. The questions themselves are unchanged.
   */
  breadcrumbs(`${site.url}/how-we-work`, [
    { name: "Home", path: "/" },
    { name: "How we work", path: "/how-we-work" },
  ]),
]);

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
      <Nav />
      <HowWeWorkPage />
      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
