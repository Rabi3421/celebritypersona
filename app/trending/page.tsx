import type { Metadata } from "next";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { TrendingBoard } from "@/components/trending/TrendingBoard";
import { getTrendingFaqs, getTrendingSearches } from "@/lib/db/content";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";

export const metadata: Metadata = pageMetadata({
  title: "Trending Celebrity Outfits in India This Week",
  description:
    "The Bollywood and Indian celebrity looks people are searching for right now, each one decoded — every piece identified, the price we could confirm, and an affordable alternative.",
  path: "/trending",
});

export default async function TrendingPage() {
  const [trendingSearches, trendingFaqs] = await Promise.all([
    getTrendingSearches(),
    getTrendingFaqs(),
  ]);

  /**
   * The leaderboard as an ItemList, the visible questions as an FAQPage, and
   * the trail the page draws. Only questions that are actually rendered are
   * marked up.
   */
  const structuredData = jsonLd([
    {
      "@type": "CollectionPage",
      "@id": `${site.url}/trending#page`,
      url: `${site.url}/trending`,
      name: "Trending celebrity outfit searches in India",
      isPartOf: { "@id": `${site.url}#website` },
      inLanguage: "en-IN",
      mainEntity: {
        "@type": "ItemList",
        name: "Trending celebrity outfit searches in India",
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        numberOfItems: trendingSearches.length,
        itemListElement: trendingSearches.map((search, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: search.term,
          description: search.answer,
          url: `${site.url}${search.href}`,
        })),
      },
    },
    ...(trendingFaqs.length
      ? [
          {
            "@type": "FAQPage",
            "@id": `${site.url}/trending#faq`,
            mainEntity: trendingFaqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          },
        ]
      : []),
    breadcrumbs(`${site.url}/trending`, [
      { name: "Home", path: "/" },
      { name: "Trending", path: "/trending" },
    ]),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
      <Nav active="trending" />
      <TrendingBoard />
      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
