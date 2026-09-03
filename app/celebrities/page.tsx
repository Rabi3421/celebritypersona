import type { Metadata } from "next";
import { CelebrityDirectory } from "@/components/celebrities/CelebrityDirectory";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { archiveTotals } from "@/lib/archive";
import { getCelebrityViews, getOutfits } from "@/lib/db/content";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";
import { celebritySlug } from "@/lib/slugs";

export const metadata: Metadata = pageMetadata({
  title: "Bollywood & Indian Celebrity Style Archives, A–Z",
  description:
    "Every Indian celebrity whose looks we have decoded, in one index — the labels she wore, what each piece cost, and affordable alternatives. Alia Bhatt to Rashmika Mandanna.",
  path: "/celebrities",
});

export default async function CelebritiesPage() {
  const [celebrities, outfits] = await Promise.all([getCelebrityViews(), getOutfits()]);

  // Only archives that actually hold a look are offered to a crawler; the
  // rest are pages with nothing on them yet.
  const stocked = celebrities.filter((celebrity) => celebrity.stats.looks > 0);
  const structuredData = jsonLd([
    {
      "@type": "CollectionPage",
      "@id": `${site.url}/celebrities#page`,
      url: `${site.url}/celebrities`,
      name: "Indian celebrity style archives",
      isPartOf: { "@id": `${site.url}#website` },
      inLanguage: "en-IN",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: stocked.length,
        itemListElement: stocked.map((celebrity, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${site.url}/celebrities/${celebritySlug(celebrity)}`,
          name: celebrity.name,
        })),
      },
    },
    breadcrumbs(`${site.url}/celebrities`, [
      { name: "Home", path: "/" },
      { name: "Celebrities", path: "/celebrities" },
    ]),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <Nav active="celebrities" />
      <CelebrityDirectory celebrities={celebrities} totals={archiveTotals(outfits)} />
      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
