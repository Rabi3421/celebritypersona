import type { Metadata } from "next";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { TrendingBoard } from "@/components/trending/TrendingBoard";
// TrendingBoard reads the questions itself; this page no longer marks them up.
import { getPublishedOutfits, getPublicTrendingRows } from "@/lib/db/content";
import { archiveCards, breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";

/**
 * Its own photographs, not the brand hero. See `archiveCards` in lib/seo.ts:
 * every hub used to share the same picture.
 */
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
  title: "Trending Celebrity Outfit Questions & Latest Looks",
  description:
    "The Indian celebrity outfit questions readers ask us most, each answered from the decoded archive — the pieces we identified, the prices we confirmed, and what a rebuild costs.",
  path: "/trending",
    images: archiveCards(await getPublishedOutfits()),
  });
}

/** A TTL backstop behind the panel's own revalidation. See the note in
 *  app/outfits/[slug]/page.tsx. */
export const revalidate = 3600;

export default async function TrendingPage() {
  const trendingSearches = await getPublicTrendingRows();

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
    /*
     * No FAQPage markup.
     *
     * Since Google narrowed FAQ rich results in August 2023 they are shown
     * only for well-known government and health sites, so a fashion archive
     * earns nothing from the markup — while still having to keep it in step
     * with the visible copy, which is a way to end up publishing an answer
     * the page no longer gives. The questions below are for readers, and for
     * anything reading the page itself.
     */
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
