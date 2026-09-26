import type { Metadata } from "next";
import { occasionDescription, occasionHeadline } from "@/lib/hub-pages";
import { hubDescription, hubTitle } from "@/lib/hub-seo";
import { hubIndexable, wordCount } from "@/lib/indexing";
import { notFound, permanentRedirect } from "next/navigation";
import { OccasionDetail } from "@/components/occasions/OccasionDetail";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { occasionSlug, outfitSlug } from "@/lib/slugs";
import { outfitsForOccasion } from "@/lib/archive";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";
import { getOccasionBySlug, getOccasionViews, getPublishedOutfits, movedOccasionSlug } from "@/lib/db/content";

type Props = { params: Promise<{ slug: string }> };

// Records added in the admin panel render on demand instead of 404ing
// until the next build.
export const dynamicParams = true;

/** A TTL backstop behind the panel's own revalidation. See the note in
 *  app/outfits/[slug]/page.tsx. */
export const revalidate = 3600;

export async function generateStaticParams() {
  const occasions = await getOccasionViews();
  return occasions.map((occasion) => ({ slug: occasionSlug(occasion) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const occasion = await getOccasionBySlug(slug);
  if (!occasion) return {};

  const photo = occasion.stats.photos[0];
  return pageMetadata({
    // The editor's own when set, else the generated one. See lib/hub-seo.ts.
    title: hubTitle(occasion, occasionHeadline(occasion)),
    absoluteTitle: true,
    description: hubDescription(occasion, occasionDescription(occasion)),
    path: `/occasions/${occasionSlug(occasion)}`,
    images: photo
      ? [{ url: photo, alt: `A ${occasion.name.toLowerCase()} look decoded on CelebrityPersona` }]
      : undefined,
    // An occasion with no look behind it is a guide with nothing to show.
    index: hubIndexable({ looks: occasion.stats.looks, introWords: wordCount(occasion.intro) }),
  });
}

export default async function OccasionPage({ params }: Props) {
  const { slug } = await params;
  const [occasion, outfits, occasions] = await Promise.all([
    getOccasionBySlug(slug),
    getPublishedOutfits(),
    getOccasionViews(),
  ]);
  if (!occasion) {
    // The record may simply have been renamed since this link was made.
    const moved = await movedOccasionSlug(slug);
    if (moved) permanentRedirect(`/occasions/${moved}`);
    notFound();
  }

  const archive = outfitsForOccasion(outfits, occasion.name);
  /**
   * The rail is headed "Other <group> occasions", so it has to contain them.
   *
   * It used to pad itself with occasions from any group once the page's own
   * group ran out, on the reasoning that no page should be a dead end. That
   * put Casual, Promo tour and Airport under the heading "Other festival
   * occasions" on /occasions/diwali — three things that are not festivals,
   * presented as festivals. An empty rail is a smaller problem than a
   * mislabelled one, and the page already links to /occasions in its
   * breadcrumb, so it is never actually a dead end.
   */
  const related = occasions
    .filter(
      (item) => item.id !== occasion.id && item.group === occasion.group && item.stats.looks > 0,
    )
    .slice(0, 4);

  const canonical = `${site.url}/occasions/${occasionSlug(occasion)}`;

  const structuredData = jsonLd([
    {
      "@type": "CollectionPage",
      "@id": `${canonical}#page`,
      url: canonical,
      name: hubTitle(occasion, occasionHeadline(occasion)),
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
