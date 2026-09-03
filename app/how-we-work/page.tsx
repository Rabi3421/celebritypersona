import type { Metadata } from "next";
import { HowWeWorkPage, howWeWorkFaqs } from "@/components/editorial/HowWeWorkPage";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";

export const metadata: Metadata = pageMetadata({
  title: "How We Decode a Celebrity Look — Our Method",
  description: "The five steps behind every decode: sourcing the photograph, identifying each piece by hand, pricing the original, finding an affordable alternative, and re-checking the links.",
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
  {
    "@type": "FAQPage",
    "@id": `${site.url}/how-we-work#faq`,
    mainEntity: howWeWorkFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  },
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
