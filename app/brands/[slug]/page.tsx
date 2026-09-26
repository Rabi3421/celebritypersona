import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { HubIntro, HubLooks } from "@/components/hubs/HubLooks";
import styles from "@/components/hubs/hub.module.css";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { swappedToBrand, wornByBrand } from "@/lib/archive";
import { getBrandBySlug, getBrandViews, getPublishedOutfits, movedBrandSlug } from "@/lib/db/content";
import { brandDescription, brandHeadline } from "@/lib/hub-pages";
import { hubDescription, hubTitle } from "@/lib/hub-seo";
import { hubIndexable, wordCount } from "@/lib/indexing";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";
import { nameSlug, outfitSlug } from "@/lib/slugs";

type Props = { params: Promise<{ slug: string }> };

/**
 * Every decoded look from one label: the looks where a celebrity wore it, and
 * the looks where it is the affordable swap. Brand names come from the
 * outfits, so a label gets a page the moment a look names it; the record adds
 * the intro and search fields.
 */
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getBrandViews()).map((brand) => ({ slug: nameSlug(brand.name) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) return {};
  return pageMetadata({
    title: hubTitle(brand, brandHeadline(brand)),
    absoluteTitle: true,
    description: hubDescription(brand, brandDescription(brand)),
    path: `/brands/${slug}`,
    images: brand.stats.photo ? [{ url: brand.stats.photo, alt: `A celebrity look featuring ${brand.name}` }] : undefined,
    index: hubIndexable({ looks: brand.stats.looks, introWords: wordCount(brand.intro) }),
  });
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  const [brand, outfits] = await Promise.all([getBrandBySlug(slug), getPublishedOutfits()]);
  if (!brand) {
    const moved = await movedBrandSlug(slug);
    if (moved) permanentRedirect(`/brands/${moved}`);
    notFound();
  }

  const worn = wornByBrand(outfits, brand.name);
  const swapped = swappedToBrand(outfits, brand.name);
  const url = `${site.url}/brands/${slug}`;
  const heading = hubTitle(brand, brandHeadline(brand));

  const structuredData = jsonLd([
    {
      "@type": "CollectionPage",
      "@id": `${url}#page`,
      url,
      name: heading,
      description: hubDescription(brand, brandDescription(brand)),
      isPartOf: { "@id": `${site.url}#website` },
      inLanguage: "en-IN",
      about: { "@type": "Brand", name: brand.name },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: worn.length + swapped.length,
        itemListElement: [...worn, ...swapped].map((outfit, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${site.url}/outfits/${outfitSlug(outfit)}`,
        })),
      },
    },
    breadcrumbs(url, [
      { name: "Home", path: "/" },
      { name: "Brands", path: "/brands" },
      { name: brand.name, path: `/brands/${slug}` },
    ]),
  ]);

  return (
    <>
      <Nav />
      <main className={styles.page}>
        <div className={styles.shell}>
          <nav className={styles.crumb} aria-label="Breadcrumb">
            <Link href="/">Home</Link>›<Link href="/brands">Brands</Link>›<span>{brand.name}</span>
          </nav>
          <header className={styles.head}>
            <p className={styles.eyebrow}>
              {brand.stats.looks} {brand.stats.looks === 1 ? "look" : "looks"} decoded
            </p>
            <h1>{heading}</h1>
            <HubIntro paragraphs={brand.intro} />
          </header>
          <HubLooks title={`Celebrities wearing ${brand.name}`} outfits={worn} />
          <HubLooks title={`${brand.name} as the affordable swap`} outfits={swapped} />
        </div>
      </main>
      <Footer />
      <MobileTabs />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
    </>
  );
}
