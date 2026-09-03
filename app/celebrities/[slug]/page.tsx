import type { Metadata } from "next";
import { plural } from "@/lib/format";
import { notFound } from "next/navigation";
import { CelebrityProfile } from "@/components/celebrities/CelebrityProfile";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { celebrityBio } from "@/lib/celebrity-bio";
import { celebritySlug, outfitSlug } from "@/lib/slugs";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";
import { getCelebrityBySlug, getCelebrityViews, getOutfits } from "@/lib/db/content";
import type { CelebrityView } from "@/lib/archive";

type Props = { params: Promise<{ slug: string }> };

// Records added in the admin panel render on demand instead of 404ing
// until the next build.
export const dynamicParams = true;

export async function generateStaticParams() {
  const celebrities = await getCelebrityViews();
  return celebrities.map((celebrity) => ({ slug: celebritySlug(celebrity) }));
}

/**
 * What an archive page is for, said the way people search for it.
 *
 * The searches these pages can win are "<name> outfits", "<name> dress",
 * "<name> airport look", "<name> style" — so the title leads with the name and
 * the words, not with "Style Archive". The look count stays in the description
 * where it is useful rather than in the blue link where it costs width.
 */
function describe(celebrity: CelebrityView) {
  const { looks, occasions, brands } = celebrity.stats;
  const her = celebrity.name;

  if (looks === 0) {
    return `${her} outfits, decoded piece by piece — the brand of every item, the price where we could confirm it, and an affordable alternative. No look is decoded yet; new ones are added as they are published.`;
  }

  const events = occasions.slice(0, 3).map((occasion) => occasion.name.toLowerCase());
  const labels = brands.slice(0, 2).map((brand) => brand.name);
  const where = events.length ? ` Covering ${events.join(", ")} looks.` : "";
  const who = labels.length ? ` Labels worn include ${labels.join(" and ")}.` : "";
  return `${plural(looks, "look")} of ${her}'s decoded piece by piece — every item identified, priced where confirmed, with affordable alternatives.${where}${who}`.slice(
    0,
    300,
  );
}

function headline(celebrity: CelebrityView) {
  const { looks } = celebrity.stats;
  // "Outfits, Dresses & Style" is the phrase set these archives compete on;
  // the count is only worth the width once there is a real archive behind it.
  return looks >= 3
    ? `${celebrity.name} Outfits, Dresses & Style — ${plural(looks, "Look")} Decoded`
    : `${celebrity.name} Outfits, Dresses & Style`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const celebrity = await getCelebrityBySlug(slug);
  if (!celebrity) return {};

  const photo = celebrity.stats.photos[0];
  return pageMetadata({
    title: headline(celebrity),
    absoluteTitle: true,
    description: describe(celebrity),
    path: `/celebrities/${celebritySlug(celebrity)}`,
    type: "profile",
    images: photo ? [{ url: photo, alt: `${celebrity.name}, decoded on CelebrityPersona` }] : undefined,
    // An archive with nothing in it is a heading, a stock-free frame and a
    // "nothing decoded here yet". Submitting twenty of those is how a new site
    // teaches Google that its pages are not worth crawling.
    index: celebrity.stats.looks > 0,
  });
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
  /**
   * The rail used to lead with whoever had the biggest archive, which meant
   * every page pointed at the same five names. It now prefers people this
   * archive actually shares an occasion with, so the link says something.
   */
  const hers = new Set(celebrityOutfits.map((outfit) => outfit.occasion));
  const similar = celebrities
    .filter((item) => item.id !== celebrity.id && item.stats.looks > 0)
    .sort((a, b) => {
      const shared = (view: CelebrityView) =>
        view.stats.occasions.filter((occasion) => hers.has(occasion.name)).length;
      return shared(b) - shared(a) || b.stats.looks - a.stats.looks;
    })
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
