import type { Metadata } from "next";
import { celebrityDescription, celebrityHeadline } from "@/lib/hub-pages";
import { hubDescription, hubTitle } from "@/lib/hub-seo";
import { hubIndexable, wordCount } from "@/lib/indexing";
import { notFound, permanentRedirect } from "next/navigation";
import { CelebrityProfile } from "@/components/celebrities/CelebrityProfile";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { celebrityBio } from "@/lib/celebrity-bio";
import { celebritySlug, outfitSlug } from "@/lib/slugs";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";
import { getCelebrityBySlug, getCelebrityViews, getPublishedOutfits, movedCelebritySlug } from "@/lib/db/content";
import type { CelebrityView } from "@/lib/archive";
import { sameName } from "@/lib/archive";

type Props = { params: Promise<{ slug: string }> };

// Records added in the admin panel render on demand instead of 404ing
// until the next build.
export const dynamicParams = true;

/** A TTL backstop behind the panel's own revalidation. See the note in
 *  app/outfits/[slug]/page.tsx. */
export const revalidate = 3600;

export async function generateStaticParams() {
  const celebrities = await getCelebrityViews();
  return celebrities.map((celebrity) => ({ slug: celebritySlug(celebrity) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const celebrity = await getCelebrityBySlug(slug);
  if (!celebrity) return {};

  const photo = celebrity.stats.photos[0];
  return pageMetadata({
    // The editor's own when set, else the generated one. See lib/hub-seo.ts.
    title: hubTitle(celebrity, celebrityHeadline(celebrity)),
    absoluteTitle: true,
    description: hubDescription(celebrity, celebrityDescription(celebrity)),
    path: `/celebrities/${celebritySlug(celebrity)}`,
    type: "profile",
    images: photo ? [{ url: photo, alt: `${celebrity.name}, decoded on CelebrityPersona` }] : undefined,
    // An archive with nothing in it is a heading, a stock-free frame and a
    // "nothing decoded here yet". Submitting twenty of those is how a new site
    // teaches Google that its pages are not worth crawling.
    index: hubIndexable({ looks: celebrity.stats.looks, introWords: wordCount(celebrity.bio) }),
  });
}

export default async function CelebrityProfilePage({ params }: Props) {
  const { slug } = await params;
  const [celebrity, outfits, celebrities] = await Promise.all([
    getCelebrityBySlug(slug),
    getPublishedOutfits(),
    getCelebrityViews(),
  ]);
  if (!celebrity) {
    // The record may simply have been renamed since this link was made.
    const moved = await movedCelebritySlug(slug);
    if (moved) permanentRedirect(`/celebrities/${moved}`);
    notFound();
  }

  const celebrityOutfits = outfits.filter((outfit) => sameName(outfit.celebrity, celebrity.name));
  /**
   * The rail used to lead with whoever had the biggest archive, which meant
   * every page pointed at the same five names. It now prefers people this
   * archive actually shares an occasion with, so the link says something.
   */
  const hers = new Set(celebrityOutfits.map((outfit) => outfit.occasion));
  const herLabels = new Set(
    celebrityOutfits.flatMap((outfit) => outfit.items.map((item) => item.wornBrand).filter(Boolean)),
  );

  /**
   * Everyone was ranked by how much they share with her and then the top five
   * were taken regardless — so with ten archives that mostly share nothing,
   * "Similar style archives" was an arbitrary list of whoever sorted first,
   * presented as a similarity.
   *
   * An archive has to actually share an occasion or a label to appear. When
   * none does, the rail is absent: "here are five people with nothing in
   * common with her" is worse than no rail, and the page has other routes out.
   */
  const shared = (view: CelebrityView) =>
    view.stats.occasions.filter((occasion) => hers.has(occasion.name)).length +
    view.stats.brands.filter((brand) => herLabels.has(brand.name)).length;

  const similar = celebrities
    .filter((item) => item.id !== celebrity.id && item.stats.looks > 0 && shared(item) > 0)
    .sort((a, b) => shared(b) - shared(a) || b.stats.looks - a.stats.looks)
    .slice(0, 5);

  const canonical = `${site.url}/celebrities/${celebritySlug(celebrity)}`;
  const bio = celebrityBio(celebrity);

  /**
   * A Person for the name the page is about, and an ItemList naming her looks
   * so the crawl reaches them from here. Both describe what the page visibly
   * says; nothing is asserted that a reader could not also read.
   */
  const structuredData = jsonLd([
    {
      "@type": "ProfilePage",
      "@id": `${canonical}#page`,
      url: canonical,
      isPartOf: { "@id": `${site.url}#website` },
      inLanguage: "en-IN",
      ...(celebrity.stats.lastChecked ? { dateModified: celebrity.stats.lastChecked } : {}),
      mainEntity: {
        "@type": "Person",
        "@id": `${canonical}#person`,
        name: celebrity.name,
        url: canonical,
        description: bio[0],
        ...(celebrity.sameAs?.length ? { sameAs: celebrity.sameAs } : {}),
        ...(celebrity.stats.photos[0] ? { image: celebrity.stats.photos[0] } : {}),
      },
      about: { "@id": `${canonical}#person` },
    },
    ...(celebrityOutfits.length
      ? [
          {
            "@type": "ItemList",
            "@id": `${canonical}#looks`,
            name: `${celebrity.name} looks decoded`,
            numberOfItems: celebrityOutfits.length,
            itemListElement: celebrityOutfits.map((outfit, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: `${site.url}/outfits/${outfitSlug(outfit)}`,
              name: `${outfit.celebrity} at ${outfit.event}`,
            })),
          },
        ]
      : []),
    breadcrumbs(canonical, [
      { name: "Home", path: "/" },
      { name: "Celebrities", path: "/celebrities" },
      { name: celebrity.name, path: `/celebrities/${celebritySlug(celebrity)}` },
    ]),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <Nav active="celebrities" />
      <CelebrityProfile celebrity={celebrity} outfits={celebrityOutfits} similar={similar} />
      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
