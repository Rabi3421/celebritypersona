import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CelebrityProfile } from "@/components/celebrities/CelebrityProfile";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { celebrities, celebritySlug, getCelebrityBySlug } from "@/lib/celebrities-content";
import { outfits } from "@/lib/outfits-content";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return celebrities.map((celebrity) => ({ slug: celebritySlug(celebrity) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const celebrity = getCelebrityBySlug(slug);
  if (!celebrity) return {};
  return {
    title: `${celebrity.name} Style Archive — ${celebrity.looks} looks decoded`,
    description: `Explore ${celebrity.name}'s style archive with brands, original prices, affordable swaps, and ${celebrity.looks} decoded looks.`,
  };
}

export default async function CelebrityProfilePage({ params }: Props) {
  const { slug } = await params;
  const celebrity = getCelebrityBySlug(slug);
  if (!celebrity) notFound();

  const celebrityOutfits = outfits.filter((outfit) => outfit.celebrity === celebrity.name);
  const similar = celebrities.filter((item) => item.id !== celebrity.id).slice(0, 5);

  return (
    <>
      <Nav active="celebrities" />
      <CelebrityProfile celebrity={celebrity} outfits={celebrityOutfits} similar={similar} />
      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
