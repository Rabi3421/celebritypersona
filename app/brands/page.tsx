import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/hubs/hub.module.css";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { getBrandViews } from "@/lib/db/content";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";
import { nameSlug } from "@/lib/slugs";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Brands Celebrities Wear — Labels, Looks & Affordable Swaps",
    absoluteTitle: true,
    description:
      "Every label in the archive: the designers Indian celebrities wear and the high-street brands we swap them for, each with its decoded looks and ₹ prices.",
    path: "/brands",
  });
}

/** Every label with a look behind it, commonest first. The page every brand
 *  page is linked from. */
export default async function BrandsPage() {
  const brands = (await getBrandViews()).filter((brand) => brand.stats.looks > 0);
  const url = `${site.url}/brands`;
  const structuredData = jsonLd([
    {
      "@type": "CollectionPage",
      "@id": `${url}#page`,
      url,
      name: "Brands celebrities wear",
      isPartOf: { "@id": `${site.url}#website` },
      inLanguage: "en-IN",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: brands.length,
        itemListElement: brands.map((brand, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${site.url}/brands/${nameSlug(brand.name)}`,
          name: brand.name,
        })),
      },
    },
    breadcrumbs(url, [
      { name: "Home", path: "/" },
      { name: "Brands", path: "/brands" },
    ]),
  ]);

  return (
    <>
      <Nav />
      <main className={styles.page}>
        <div className={styles.shell}>
          <nav className={styles.crumb} aria-label="Breadcrumb">
            <Link href="/">Home</Link>›<span>Brands</span>
          </nav>
          <header className={styles.head}>
            <p className={styles.eyebrow}>{brands.length} labels</p>
            <h1>Brands celebrities wear</h1>
          </header>
          <div className={styles.list}>
            {brands.map((brand) => (
              <Link href={`/brands/${nameSlug(brand.name)}`} key={brand.name}>
                <b>{brand.name}</b>
                <span>
                  {brand.stats.looks} {brand.stats.looks === 1 ? "look" : "looks"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
      <MobileTabs />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
    </>
  );
}
