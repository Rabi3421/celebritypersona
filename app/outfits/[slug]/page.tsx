import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OutfitDetail } from "@/components/outfits/OutfitDetail";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { garmentOf } from "@/lib/archive";
import { nameSlug, outfitSlug } from "@/lib/slugs";
import { hasSubstance, hasWornBrand, hasWornPrice, outfitPhotos, pricing } from "@/lib/types";
import type { Outfit } from "@/lib/types";
import { getCelebrities, getOutfitBySlug, getOutfits } from "@/lib/db/content";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
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
  // Only the labels we have actually identified. "by " with nothing after it
  // is worse than not naming a label at all.
  const named = [...new Set(outfit.items.filter(hasWornBrand).map((item) => item.wornBrand))];
  const by = named.length ? ` by ${named.join(", ")}` : "";

  if (money.anySwapped) {
    return `Every piece ${outfit.celebrity} wore at ${outfit.event} — ${pieces}${by}, with price-checked swaps from ${inr(money.swapTotal)}.`;
  }
  if (money.anyPriced) {
    return `Every piece ${outfit.celebrity} wore at ${outfit.event}, identified and priced — ${pieces}${by}, ${inr(money.wornTotal)} as worn.`;
  }
  return `Every piece ${outfit.celebrity} wore at ${outfit.event}, identified piece by piece — ${pieces}${by}.`;
}

/** Google shows about 60 characters, and 65 is where a fitted title starts
 *  being cut. */
const TITLE_LIMIT = 62;

/**
 * The piece the look is really about: the dearest one we could price, and the
 * first otherwise. A page called "Ritika Nayak at Fashion Photoshoot" answers
 * a question nobody asks — the searches are for the garment and the label.
 */
function leadPiece(outfit: Outfit) {
  const priced = outfit.items.filter(hasWornPrice);
  if (priced.length) {
    return priced.reduce((dearest, item) =>
      (item.worn ?? 0) > (dearest.worn ?? 0) ? item : dearest,
    );
  }
  return outfit.items[0];
}

/**
 * Occasion words worth carrying into the title, because "<name> airport look"
 * and "<name> wedding look" are searched far more than the event's own name.
 * Anything not listed here is left out rather than bent into a phrase.
 */
const OCCASION_PHRASE: Record<string, string> = {
  Airport: "Airport Look",
  "Red carpet": "Red Carpet Look",
  Sangeet: "Sangeet Look",
  Mehendi: "Mehendi Look",
  Reception: "Reception Look",
  Haldi: "Haldi Look",
  Engagement: "Engagement Look",
  Diwali: "Diwali Look",
  Navratri: "Navratri Look",
  Holi: "Holi Look",
  Eid: "Eid Look",
  "Karwa Chauth": "Karwa Chauth Look",
  "Promo tour": "Promo Look",
};

/**
 * What the search result's blue link says. The editor's own title wins;
 * otherwise the widest form that fits, preferring the shapes people actually
 * type: her name, the occasion, the garment, the label.
 */
function headline(outfit: Outfit) {
  const own = outfit.seoTitle?.trim();
  if (own) return own;

  const piece = leadPiece(outfit);
  const fallback = `${outfit.celebrity} at ${outfit.event}`;
  if (!piece) return fallback;

  const garment = garmentOf(piece.name);
  const occasion = OCCASION_PHRASE[outfit.occasion];
  const label = piece.wornBrand;
  const candidates = [
    label && occasion && `${outfit.celebrity} ${occasion}: ${piece.name} by ${label}`,
    label && occasion && `${outfit.celebrity} ${occasion}: ${garment} by ${label}`,
    label && `${outfit.celebrity}'s ${piece.name} — ${label}`,
    label && `${outfit.celebrity}'s ${garment} — ${label}`,
    occasion && `${outfit.celebrity} ${occasion}: ${garment}`,
    `${outfit.celebrity}'s ${piece.name}`,
    `${outfit.celebrity}'s ${garment}`,
  ].filter((value): value is string => Boolean(value));
  return candidates.find((candidate) => candidate.length <= TITLE_LIMIT) ?? fallback;
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
    getOutfits(),
    getCelebrities(),
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
        author: {
          "@type": "Person",
          name: "Rabi",
          url: `${site.url}/about`,
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
        ...(photos.length ? { image: photos.map((photo) => photo.url) } : {}),
        // Only pieces with a confirmed price carry an offer: the old shape
        // emitted price "undefined" for anything still being checked.
        mentions: outfit.items.map((item) => ({
          "@type": "Product",
          name: item.name,
          ...(item.wornBrand ? { brand: { "@type": "Brand", name: item.wornBrand } } : {}),
          ...(item.note ? { description: item.note } : {}),
          ...(hasWornPrice(item)
            ? {
                offers: {
                  "@type": "Offer",
                  price: String(item.worn),
                  priceCurrency: "INR",
                  // A link is not stock. Saying InStock because a URL exists is
                  // a guess dressed as a fact, and a reader who clicks through
                  // to a sold-out page has been told something untrue by us.
                  availability: item.soldOut
                    ? "https://schema.org/OutOfStock"
                    : item.wornUrl
                      ? "https://schema.org/InStock"
                      : "https://schema.org/Discontinued",
                  ...(item.wornUrl ? { url: item.wornUrl } : {}),
                },
              }
            : {}),
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
