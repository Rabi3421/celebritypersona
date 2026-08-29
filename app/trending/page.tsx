import type { Metadata } from "next";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { TrendingBoard } from "@/components/trending/TrendingBoard";
import { getTrendingFaqs, getTrendingSearches } from "@/lib/db/content";

export const metadata: Metadata = {
  title: "Trending Celebrity Outfits — What India is searching this week",
  description:
    "The most-searched Bollywood looks right now, with every piece identified, the original price, and an affordable swap you can actually order.",
  alternates: { canonical: "/trending" },
  openGraph: {
    title: "Trending Celebrity Outfits — What India is searching this week",
    description:
      "The most-searched Bollywood looks right now, each one decoded with prices and affordable swaps.",
    url: "/trending",
    type: "website",
  },
};


export default async function TrendingPage() {
  const [trendingSearches, trendingFaqs] = await Promise.all([
    getTrendingSearches(),
    getTrendingFaqs(),
  ]);

  /** ItemList for the leaderboard plus the FAQ block, in one graph. */
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        name: "Trending celebrity outfit searches in India",
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        numberOfItems: trendingSearches.length,
        itemListElement: trendingSearches.map((search, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: search.term,
          description: search.answer,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: trendingFaqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Nav active="trending" />
      <TrendingBoard />
      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
