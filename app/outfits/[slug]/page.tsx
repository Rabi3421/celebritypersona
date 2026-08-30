import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OutfitDetail } from "@/components/outfits/OutfitDetail";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { nameSlug, outfitSlug } from "@/lib/slugs";
import { hasSubstance, hasWornPrice, outfitPhotos, pricing } from "@/lib/types";
import type { Outfit } from "@/lib/types";
import { getOutfitBySlug, getOutfits } from "@/lib/db/content";
import { site } from "@/lib/site-config";

type Props = { params: Promise<{ slug: string }> };

// Records added in the admin panel render on demand instead of 404ing
// until the next build.
export const dynamicParams = true;

export async function generateStaticParams() {
  const outfits = await getOutfits();
  return outfits.map((outfit) => ({ slug: outfitSlug(outfit) }));
}

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/**
 * What the search result actually says. The editor's own first paragraph beats
 * anything generated, so it wins when there is one. Otherwise the line is built
 * from what the look really holds: it used to promise "swaps for ₹0" on every
 * look nobody had found a swap for yet.
 */
function describe(outfit: Outfit) {
  const notes = outfit.notes?.[0]?.trim();
  if (notes) return notes.length > 158 ? `${notes.slice(0, 155).trimEnd()}…` : notes;

  const money = pricing(outfit);
  const pieces = `${money.pieces} ${money.pieces === 1 ? "piece" : "pieces"}`;
  const brands = [...new Set(outfit.items.map((item) => item.wornBrand))].join(", ");

  if (money.anySwapped) {
    return `Every piece ${outfit.celebrity} wore at ${outfit.event} — ${pieces} by ${brands}, with price-checked swaps from ${inr(money.swapTotal)}.`;
  }
  if (money.anyPriced) {
    return `Every piece ${outfit.celebrity} wore at ${outfit.event}, identified and priced — ${pieces} by ${brands}, ${inr(money.wornTotal)} as worn.`;
  }
  return `Every piece ${outfit.celebrity} wore at ${outfit.event}, identified piece by piece — ${pieces} by ${brands}.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const outfit = await getOutfitBySlug(slug);
  if (!outfit) return {};

  const description = describe(outfit);
  const photo = outfitPhotos(outfit)[0];
  const path = `/outfits/${outfitSlug(outfit)}`;

  return {
    title: `${outfit.celebrity}'s ${outfit.event} Look — Decoded`,
    description,
    alternates: { canonical: path },
    // A look with no swap, no notes and no piece notes is a brand's product
    // name and a buy link. It stays browsable, but it is not worth a place in
    // the index until it says something the merchant's own page does not.
    robots: hasSubstance(outfit) ? undefined : { index: false, follow: true },
    openGraph: {
      type: "article",
      title: `${outfit.celebrity} at ${outfit.event}`,
      description,
      url: path,
      publishedTime: outfit.date,
      modifiedTime: outfit.pricesCheckedAt ?? outfit.date,
      images: photo ? [{ url: photo.url }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${outfit.celebrity} at ${outfit.event}`,
      description,
      images: photo ? [photo.url] : undefined,
    },
  };
}

export default async function OutfitPage({ params }: Props) {
  const { slug } = await params;
  const [outfit, outfits] = await Promise.all([
    getOutfitBySlug(slug),
    getOutfits(),
  ]);
  if (!outfit) notFound();

  const sameCelebrity = outfits
    .filter((item) => item.id !== outfit.id && item.celebrity === outfit.celebrity)
    .slice(0, 4);
  const sameOccasion = outfits
    .filter((item) => item.id !== outfit.id && item.occasion === outfit.occasion)
    .slice(0, 4);

  // metadataBase covers the <link rel=canonical>; JSON-LD needs it spelled out.
  const canonical = `${site.url}/outfits/${outfitSlug(outfit)}`;
  const photos = outfitPhotos(outfit);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${canonical}#article`,
        mainEntityOfPage: canonical,
        headline: `${outfit.celebrity}'s ${outfit.event} Look — Decoded`,
        description: describe(outfit),
        datePublished: outfit.date,
        dateModified: outfit.pricesCheckedAt ?? outfit.date,
        author: { "@type": "Person", name: "Rabi" },
        publisher: {
          "@type": "Organization",
          name: "CelebrityPersona",
          url: site.url,
        },
        about: { "@type": "Person", name: outfit.celebrity },
        ...(photos.length ? { image: photos.map((photo) => photo.url) } : {}),
        // Only pieces with a confirmed price carry an offer: the old shape
        // emitted price "undefined" for anything still being checked.
        mentions: outfit.items.map((item) => ({
          "@type": "Product",
          name: item.name,
          brand: { "@type": "Brand", name: item.wornBrand },
          ...(item.note ? { description: item.note } : {}),
          ...(hasWornPrice(item)
            ? {
                offers: {
                  "@type": "Offer",
                  price: String(item.worn),
                  priceCurrency: "INR",
                  availability: item.wornUrl
                    ? "https://schema.org/InStock"
                    : "https://schema.org/Discontinued",
                  ...(item.wornUrl ? { url: item.wornUrl } : {}),
                },
              }
            : {}),
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumbs`,
        itemListElement: [
          { name: "Home", item: site.url },
          { name: "Outfits", item: `${site.url}/outfits` },
          { name: outfit.celebrity, item: `${site.url}/celebrities/${nameSlug(outfit.celebrity)}` },
          { name: outfit.event, item: canonical },
        ].map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: crumb.item,
        })),
      },
    ],
  };

  return (
    <>
      <Nav active="outfits" />
      <OutfitDetail
        outfit={outfit}
        sameCelebrity={sameCelebrity}
        sameOccasion={sameOccasion}
      />
      <Footer />
      <MobileTabs active="outfits" />
      <ScrollEffects />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
}
