import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OutfitDetail } from "@/components/outfits/OutfitDetail";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { getOutfitBySlug, outfitSlug, outfits } from "@/lib/outfits-content";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return outfits.map((outfit) => ({ slug: outfitSlug(outfit) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const outfit = getOutfitBySlug(slug);
  if (!outfit) return {};

  return {
    title: `${outfit.celebrity}'s ${outfit.event} Look — Decoded`,
    description: `Every piece ${outfit.celebrity} wore at ${outfit.event}, with original prices and affordable swaps for ₹${outfit.swap.toLocaleString("en-IN")}.`,
  };
}

export default async function OutfitPage({ params }: Props) {
  const { slug } = await params;
  const outfit = getOutfitBySlug(slug);
  if (!outfit) notFound();

  const sameCelebrity = outfits
    .filter((item) => item.id !== outfit.id && item.celebrity === outfit.celebrity)
    .slice(0, 4);
  const sameOccasion = outfits
    .filter((item) => item.id !== outfit.id && item.occasion === outfit.occasion)
    .slice(0, 4);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${outfit.celebrity}'s ${outfit.event} Look — Decoded`,
    datePublished: outfit.date,
    author: { "@type": "Person", name: "Rabi" },
    about: { "@type": "Person", name: outfit.celebrity },
    mentions: outfit.items.map((item) => ({
      "@type": "Product",
      name: item.name,
      brand: item.wornBrand,
      offers: {
        "@type": "Offer",
        price: String(item.worn),
        priceCurrency: "INR",
      },
    })),
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
