import type { Metadata } from "next";
import { OutfitsExplorer } from "@/components/outfits/OutfitsExplorer";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { getPublishedOutfits } from "@/lib/db/content";
import { archiveCards, breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";
import { outfitSlug } from "@/lib/slugs";
import { hasSubstance } from "@/lib/types";

/** The cards wear a "New" badge for the first few days after a look is added,
 *  so a page prerendered once and never rebuilt would keep showing it. An hour
 *  is finer than the badge's own day-level resolution, and publishing a look
 *  revalidates the site immediately. */
export const revalidate = 3600;

/**
 * Its own photographs, not the brand hero. See `archiveCards` in lib/seo.ts:
 * every hub used to share the same picture.
 */
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
  title: "Celebrity Outfits Decoded, Piece by Piece",
  description:
    "Every Indian celebrity outfit we have decoded, piece by piece — the labels worn, the prices we confirmed, and affordable alternatives.",
  path: "/outfits",
    images: archiveCards(await getPublishedOutfits()),
  });
}

export default async function OutfitsPage() {
  const outfits = await getPublishedOutfits();

  /**
   * The index of the site's main entity type. The list names the looks Google
   * should follow from here, and skips the ones the detail pages themselves
   * decline to be indexed for.
   */
  const listed = outfits.filter(hasSubstance).slice(0, 100);
  const structuredData = jsonLd([
    {
      "@type": "CollectionPage",
      "@id": `${site.url}/outfits#page`,
      url: `${site.url}/outfits`,
      name: "Celebrity outfits decoded",
      description:
        "Indian celebrity outfits decoded piece by piece, with the labels worn, confirmed prices and affordable alternatives.",
      isPartOf: { "@id": `${site.url}#website` },
      inLanguage: "en-IN",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: listed.length,
        itemListElement: listed.map((outfit, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${site.url}/outfits/${outfitSlug(outfit)}`,
          name: `${outfit.celebrity} at ${outfit.event}`,
        })),
      },
    },
    breadcrumbs(`${site.url}/outfits`, [
      { name: "Home", path: "/" },
      { name: "Outfits", path: "/outfits" },
    ]),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <Nav active="outfits" />
      <OutfitsExplorer outfits={outfits} />
      <Footer />
      <MobileTabs active="outfits" />
      <ScrollEffects />
    </>
  );
}
