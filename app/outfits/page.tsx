import type { Metadata } from "next";
import { OutfitsExplorer } from "@/components/outfits/OutfitsExplorer";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { getOutfits } from "@/lib/db/content";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";
import { outfitSlug } from "@/lib/slugs";
import { hasSubstance } from "@/lib/types";

export const metadata: Metadata = pageMetadata({
  title: "Celebrity Outfits Decoded — Every Look, Every Price",
  description:
    "Browse every Indian celebrity outfit we have decoded, piece by piece — the labels worn, the prices we could confirm, and affordable alternatives. Filter by celebrity, occasion or budget.",
  path: "/outfits",
});

export default async function OutfitsPage() {
  const outfits = await getOutfits();

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
