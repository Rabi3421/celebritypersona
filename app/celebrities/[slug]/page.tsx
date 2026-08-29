import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CelebrityProfile } from "@/components/celebrities/CelebrityProfile";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { celebritySlug } from "@/lib/slugs";
import { getCelebrities, getCelebrityBySlug, getOutfits } from "@/lib/db/content";

type Props = { params: Promise<{ slug: string }> };

// Records added in the admin panel render on demand instead of 404ing
// until the next build.
export const dynamicParams = true;

export async function generateStaticParams() {
  const celebrities = await getCelebrities();
  return celebrities.map((celebrity) => ({ slug: celebritySlug(celebrity) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const celebrity = await getCelebrityBySlug(slug);
  if (!celebrity) return {};
  return {
    title: `${celebrity.name} Style Archive — ${celebrity.looks} looks decoded`,
    description: `Explore ${celebrity.name}'s style archive with brands, original prices, affordable swaps, and ${celebrity.looks} decoded looks.`,
  };
}

export default async function CelebrityProfilePage({ params }: Props) {
  const { slug } = await params;
  const [celebrity, outfits, celebrities] = await Promise.all([
    getCelebrityBySlug(slug),
    getOutfits(),
    getCelebrities(),
  ]);
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
