import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { OutfitDetail } from "@/components/outfits/OutfitDetail";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { sameName } from "@/lib/archive";
import { nameSlug, outfitSlug } from "@/lib/slugs";
import { hasSubstance, outfitPhotos } from "@/lib/types";
import { describe, headline } from "@/lib/outfit-seo";
import { getCelebrities, getOutfitBySlug, getPublishedOutfits, movedOutfitSlug } from "@/lib/db/content";
import { breadcrumbs, imageObject, jsonLd, pageMetadata } from "@/lib/seo";
import { author, site } from "@/lib/site-config";

type Props = { params: Promise<{ slug: string }> };

// Records added in the admin panel render on demand instead of 404ing
// until the next build.
export const dynamicParams = true;

/**
 * A backstop, not the main mechanism.
 *
 * Publishing from the panel already calls `revalidatePath("/", "layout")`, so
 * an edit reaches readers immediately. Without a TTL, though, a page rendered
 * on demand for a slug that was not in `generateStaticParams` is cached
 * indefinitely — and nothing outside the panel (a price that quietly went
 * stale, a record touched directly in the database) would ever dislodge it.
 * An hour is short enough that Googlebot never sees a badly aged page and long
 * enough that the archive is still served from cache.
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  const outfits = await getPublishedOutfits();
  return outfits.map((outfit) => ({ slug: outfitSlug(outfit) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const outfit = await getOutfitBySlug(slug);
  if (!outfit) return {};

  const description = outfit.seoDescription?.trim() || describe(outfit);
  const photos = outfitPhotos(outfit);
  const path = `/outfits/${outfitSlug(outfit)}`;

  return pageMetadata({
    // Absolute, so the site-name template cannot push a fitted title past the
    // width Google renders. The site name is carried by the WebSite graph.
    title: headline(outfit),
    absoluteTitle: true,
    description,
    path,
    type: "article",
    images: photos.map((photo) => ({
      url: photo.url,
      alt: photo.alt?.trim() || `${outfit.celebrity} at ${outfit.event}`,
    })),
    publishedTime: outfit.date,
    modifiedTime: outfit.pricesCheckedAt ?? outfit.date,
    // A look with no swap, no notes and no piece notes is a brand's product
    // name and a buy link. It stays browsable, but it is not worth a place in
    // the index until it says something the merchant's own page does not.
    index: hasSubstance(outfit),
  });
}

export default async function OutfitPage({ params }: Props) {
  const { slug } = await params;
  const [outfit, outfits, celebrities] = await Promise.all([
    getOutfitBySlug(slug),
    getPublishedOutfits(),
    getCelebrities(),
  ]);
  if (!outfit) {
    // The record may simply have been renamed since this link was made.
    const moved = await movedOutfitSlug(slug);
    if (moved) permanentRedirect(`/outfits/${moved}`);
    notFound();
  }

  const sameCelebrity = outfits
    .filter((item) => item.id !== outfit.id && sameName(item.celebrity, outfit.celebrity))
    .slice(0, 4);
  const sameOccasion = outfits
    .filter((item) => item.id !== outfit.id && sameName(item.occasion, outfit.occasion))
    .slice(0, 4);

  // metadataBase covers the <link rel=canonical>; JSON-LD needs it spelled out.
  const canonical = `${site.url}/outfits/${outfitSlug(outfit)}`;
  const photos = outfitPhotos(outfit);
  // Her own profiles, when the archive holds them. Without `sameAs` the graph
  // names a string; with it, it names the person Google already has.
  const profiles = celebrities.find(
    (celebrity) => celebrity.name === outfit.celebrity,
  )?.sameAs;

  const structuredData = jsonLd([
      {
        "@type": "Article",
        "@id": `${canonical}#article`,
        mainEntityOfPage: canonical,
        headline: headline(outfit),
        description: outfit.seoDescription?.trim() || describe(outfit),
        inLanguage: "en-IN",
        datePublished: outfit.date,
        dateModified: outfit.pricesCheckedAt ?? outfit.date,
        // Points at the author page rather than /about, which is about the
        // site rather than the person Google is asking about.
        author: {
          "@type": "Person",
          "@id": `${site.url}#author`,
          name: author.name,
          url: `${site.url}${author.path}`,
        },
        publisher: {
          "@type": "Organization",
          "@id": `${site.url}#organization`,
          name: site.name,
          url: site.url,
          logo: {
            "@type": "ImageObject",
            url: `${site.url}/brand/celebritypersona-logo.png`,
          },
        },
        about: {
          "@type": "Person",
          name: outfit.celebrity,
          url: `${site.url}/celebrities/${nameSlug(outfit.celebrity)}`,
          ...(profiles?.length ? { sameAs: profiles } : {}),
        },
        /**
         * The photographs as objects rather than bare URLs, so the caption the
         * editor wrote, the agency the page credits and the licensing terms
         * travel with the image into Google Images instead of stopping at the
         * figcaption. See `imageObject` in lib/seo.ts.
         */
        ...(photos.length ? { image: photos.map(imageObject) } : {}),
        /**
         * The pieces are named, and nothing is priced here.
         *
         * This used to emit a Product with an Offer for every piece — price,
         * currency, availability — and an `isSimilarTo` Product with an Offer
         * for every swap. Google's product markup is for a page where the
         * reader buys from the publisher. We are not the seller: we do not set
         * these prices, hold this stock, or control these listings, and
         * `check:links` has already found retailers whose pages we cannot even
         * read. Publishing price and availability we do not own claims a
         * merchant relationship that does not exist and invites a mismatch
         * against the retailer's own page, which is the thing that actually
         * costs a site its rich results.
         *
         * `mentions` still names each piece and its label, which is true and
         * is what the page is about. The prices stay where they are checkable:
         * on the page, next to the date they were checked.
         */
        mentions: outfit.items.map((item) => ({
          "@type": "Thing",
          name: item.wornBrand ? `${item.name} by ${item.wornBrand}` : item.name,
          ...(item.note ? { description: item.note } : {}),
        })),
      },
      breadcrumbs(canonical, [
        { name: "Home", path: "/" },
        { name: "Outfits", path: "/outfits" },
        { name: outfit.celebrity, path: `/celebrities/${nameSlug(outfit.celebrity)}` },
        { name: outfit.event, path: `/outfits/${outfitSlug(outfit)}` },
      ]),
  ]);

  return (
    <>
      <Nav active="outfits" />
      <OutfitDetail
        outfit={outfit}
        heading={headline(outfit)}
        sameCelebrity={sameCelebrity}
        sameOccasion={sameOccasion}
      />
      <Footer />
      <MobileTabs active="outfits" />
      <ScrollEffects />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
    </>
  );
}
