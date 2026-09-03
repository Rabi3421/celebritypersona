import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OccasionDetail } from "@/components/occasions/OccasionDetail";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { plural } from "@/lib/format";
import { occasionSlug, outfitSlug } from "@/lib/slugs";
import { outfitsForOccasion } from "@/lib/archive";
import type { OccasionView } from "@/lib/archive";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";
import { getOccasionBySlug, getOccasionViews, getOutfits } from "@/lib/db/content";

type Props = { params: Promise<{ slug: string }> };

// Records added in the admin panel render on demand instead of 404ing
// until the next build.
export const dynamicParams = true;

export async function generateStaticParams() {
  const occasions = await getOccasionViews();
  return occasions.map((occasion) => ({ slug: occasionSlug(occasion) }));
}

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/**
 * Occasion pages compete for "sangeet outfit ideas", "what to wear to a
 * mehendi", "Diwali outfit ideas" — a question, not a category. The title
 * asks it in the words people use; the description answers with what the page
 * actually holds rather than a promise it may not be able to keep.
 */
function headline(occasion: OccasionView) {
  const name = occasion.name;
  const lower = name.toLowerCase();
  // Occasions that are places or events rather than ceremonies read wrong as
  // "Sangeet Outfit Ideas" would read right.
  const asPlace = ["Airport", "Red carpet", "Promo tour", "Casual"].includes(name);
  return asPlace
    ? `Celebrity ${lower} Looks — Outfits, Brands & Prices`
    : `${name} Outfit Ideas — Celebrity Looks, Prices & Affordable Swaps`;
}

function describe(occasion: OccasionView) {
  const { looks, swapFrom, averageWorn } = occasion.stats;
  const lower = occasion.name.toLowerCase();

  if (looks === 0) {
    return `${occasion.name} outfit ideas taken from celebrity looks, decoded piece by piece with brands, prices and affordable alternatives. No ${lower} look is decoded yet.`;
  }

  const from = swapFrom === null ? "" : ` Complete looks rebuild from ${inr(swapFrom)}.`;
  const worn = averageWorn === null ? "" : ` The originals average ${inr(averageWorn)}.`;
  return `What to wear to ${lower === "airport" ? "the airport" : `a ${lower}`}, taken from ${plural(looks, "celebrity look")} decoded piece by piece — every item identified and priced, with affordable alternatives.${from}${worn}`.slice(
    0,
    300,
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const occasion = await getOccasionBySlug(slug);
  if (!occasion) return {};

  const photo = occasion.stats.photos[0];
  return pageMetadata({
    title: headline(occasion),
    absoluteTitle: true,
    description: describe(occasion),
    path: `/occasions/${occasionSlug(occasion)}`,
    images: photo
      ? [{ url: photo, alt: `A ${occasion.name.toLowerCase()} look decoded on CelebrityPersona` }]
      : undefined,
    // An occasion with no look behind it is a guide with nothing to show.
    index: occasion.stats.looks > 0,
  });
}

export default async function OccasionPage({ params }: Props) {
  const { slug } = await params;
  const [occasion, outfits, occasions] = await Promise.all([
    getOccasionBySlug(slug),
    getOutfits(),
    getOccasionViews(),
  ]);
  if (!occasion) notFound();

  const archive = outfitsForOccasion(outfits, occasion.name);
  /**
   * The rail used to show only occasions in the same group, which left the
   * single-member groups pointing nowhere. It now fills up with other stocked
   * occasions so no page is a dead end.
   */
  const sameGroup = occasions.filter(
    (item) => item.id !== occasion.id && item.group === occasion.group && item.stats.looks > 0,
  );
  const others = occasions.filter(
    (item) =>
      item.id !== occasion.id &&
      item.group !== occasion.group &&
      item.stats.looks > 0,
  );
  const related = [...sameGroup, ...others].slice(0, 4);

  const canonical = `${site.url}/occasions/${occasionSlug(occasion)}`;

  const structuredData = jsonLd([
    {
      "@type": "CollectionPage",
      "@id": `${canonical}#page`,
      url: canonical,
      name: headline(occasion),
      description: occasion.description,
      isPartOf: { "@id": `${site.url}#website` },
      inLanguage: "en-IN",
      ...(occasion.stats.lastChecked ? { dateModified: occasion.stats.lastChecked } : {}),
      ...(archive.length
        ? {
            mainEntity: {
              "@type": "ItemList",
              name: `${occasion.name} looks decoded`,
              numberOfItems: archive.length,
              itemListElement: archive.map((outfit, index) => ({
                "@type": "ListItem",
                position: index + 1,
                url: `${site.url}/outfits/${outfitSlug(outfit)}`,
                name: `${outfit.celebrity} at ${outfit.event}`,
              })),
            },
          }
        : {}),
    },
    breadcrumbs(canonical, [
      { name: "Home", path: "/" },
      { name: "Occasions", path: "/occasions" },
      { name: occasion.name, path: `/occasions/${occasionSlug(occasion)}` },
    ]),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <Nav active="occasions" />
      <OccasionDetail occasion={occasion} outfits={archive} related={related} />
      <Footer />
      <MobileTabs active="occasions" />
      <ScrollEffects />
    </>
  );
}
