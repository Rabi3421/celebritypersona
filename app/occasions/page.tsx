import type { Metadata } from "next";
import { OccasionsDirectory } from "@/components/occasions/OccasionsDirectory";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { getOccasionViews } from "@/lib/db/content";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";
import { occasionSlug } from "@/lib/slugs";

export const metadata: Metadata = pageMetadata({
  title: "Outfit Ideas by Occasion: Sangeet, Mehendi, Diwali & More",
  absoluteTitle: true,
  description:
    "What to wear to a sangeet, mehendi, reception, Diwali party or the airport, taken from celebrity looks decoded piece by piece — with prices and affordable alternatives.",
  path: "/occasions",
});

export default async function OccasionsPage() {
  const occasions = await getOccasionViews();
  const stocked = occasions.filter((occasion) => occasion.stats.looks > 0);

  const structuredData = jsonLd([
    {
      "@type": "CollectionPage",
      "@id": `${site.url}/occasions#page`,
      url: `${site.url}/occasions`,
      name: "Celebrity outfit ideas by occasion",
      isPartOf: { "@id": `${site.url}#website` },
      inLanguage: "en-IN",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: stocked.length,
        itemListElement: stocked.map((occasion, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${site.url}/occasions/${occasionSlug(occasion)}`,
          name: `${occasion.name} outfits`,
        })),
      },
    },
    breadcrumbs(`${site.url}/occasions`, [
      { name: "Home", path: "/" },
      { name: "Occasions", path: "/occasions" },
    ]),
  ]);

  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} /><Nav active="occasions" /><OccasionsDirectory /><Footer /><MobileTabs active="occasions" /><ScrollEffects /></>;
}
