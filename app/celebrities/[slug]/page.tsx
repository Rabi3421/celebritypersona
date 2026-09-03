import type { Metadata } from "next";
import { plural } from "@/lib/format";
import { notFound } from "next/navigation";
import { CelebrityProfile } from "@/components/celebrities/CelebrityProfile";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { celebritySlug } from "@/lib/slugs";
import { getCelebrityBySlug, getCelebrityViews, getOutfits } from "@/lib/db/content";

type Props = { params: Promise<{ slug: string }> };

// Records added in the admin panel render on demand instead of 404ing
// until the next build.
export const dynamicParams = true;

export async function generateStaticParams() {
  const celebrities = await getCelebrityViews();
  return celebrities.map((celebrity) => ({ slug: celebritySlug(celebrity) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const celebrity = await getCelebrityBySlug(slug);
  if (!celebrity) return {};
  const { looks } = celebrity.stats;
  return {
    title: `${celebrity.name} Style Archive — ${plural(looks, "look")} decoded`,
    description: `Explore ${celebrity.name}'s style archive with brands, original prices, affordable swaps, and ${looks} decoded ${looks === 1 ? "look" : "looks"}.`,
  };
}

export default async function CelebrityProfilePage({ params }: Props) {
  const { slug } = await params;
  const [celebrity, outfits, celebrities] = await Promise.all([
    getCelebrityBySlug(slug),
    getOutfits(),
    getCelebrityViews(),
  ]);
  if (!celebrity) notFound();

  const celebrityOutfits = outfits.filter((outfit) => outfit.celebrity === celebrity.name);
  // Nearest by size of archive, so the rail leads with names worth a click.
  const similar = celebrities.filter((item) => item.id !== celebrity.id && item.stats.looks > 0).slice(0, 5);

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
