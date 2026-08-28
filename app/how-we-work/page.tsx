import type { Metadata } from "next";
import { HowWeWorkPage, howWeWorkFaqs } from "@/components/editorial/HowWeWorkPage";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";

export const metadata: Metadata = {
  title: "How We Work — Our method for decoding a celebrity look",
  description:
    "The five steps behind every decode: sourcing the photograph, identifying each piece by hand, pricing the original, finding the swap, and re-checking weekly.",
  alternates: { canonical: "/how-we-work" },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: howWeWorkFaqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Nav />
      <HowWeWorkPage />
      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
