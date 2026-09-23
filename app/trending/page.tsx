import type { Metadata } from "next";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { TrendingBoard } from "@/components/trending/TrendingBoard";
import { getTrendingFaqs, getPublicTrendingRows } from "@/lib/db/content";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";

export const metadata: Metadata = pageMetadata({
  title: "Trending Celebrity Outfit Questions & Latest Looks",
  description:
    "The Indian celebrity outfit questions readers ask us most, each answered from the decoded archive — the pieces we identified, the prices we confirmed, and what a rebuild costs.",
  path: "/trending",
});

/** A TTL backstop behind the panel's own revalidation. See the note in
 *  app/outfits/[slug]/page.tsx. */
export const revalidate = 3600;

export default async function TrendingPage() {
  const [trendingSearches, trendingFaqs] = await Promise.all([
    getPublicTrendingRows(),
    getTrendingFaqs(),
  ]);

  /**
   * The leaderboard as an ItemList, the visible questions as an FAQPage, and
   * the trail the page draws. Only questions that are actually rendered are
   * marked up.
   *
   * A row we have not decoded stays on the page — it is a real question people
   * ask us — but it is left out of the ItemList. Marking up ten entries whose
   * description reads "Not decoded yet" would offer Google a list of answers
   * the site does not have, which is the same overclaim the old hand-written
   * blurbs made, just in JSON-LD. With nothing decoded the list is dropped
   * rather than published empty.
   */
  // Already only the answered, published rows.
  const decodedRows = trendingSearches;
  const structuredData = jsonLd([
    {
      "@type": "CollectionPage",
      "@id": `${site.url}/trending#page`,
      url: `${site.url}/trending`,
      name: "Trending celebrity outfit searches in India",
      isPartOf: { "@id": `${site.url}#website` },
      inLanguage: "en-IN",
      ...(decodedRows.length
        ? {
            mainEntity: {
              "@type": "ItemList",
              name: "Trending celebrity outfit searches in India",
              itemListOrder: "https://schema.org/ItemListOrderDescending",
              numberOfItems: decodedRows.length,
              itemListElement: decodedRows.map((search, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: search.term,
                description: search.answer,
                url: `${site.url}${search.href}`,
              })),
            },
          }
        : {}),
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
