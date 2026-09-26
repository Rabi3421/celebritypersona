import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HubIntro, HubLooks } from "@/components/hubs/HubLooks";
import styles from "@/components/hubs/hub.module.css";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { BUDGET_CAPS, budgetCapFromSlug, budgetLabel, budgetPrice, budgetSlug, looksUnder } from "@/lib/budget";
import { getBudgetPages, getPublishedOutfits } from "@/lib/db/content";
import { budgetDescription, budgetHeadline } from "@/lib/hub-pages";
import { hubDescription, hubTitle } from "@/lib/hub-seo";
import { hubIndexable, wordCount } from "@/lib/indexing";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";
import { outfitSlug } from "@/lib/slugs";

type Props = { params: Promise<{ bucket: string }> };

/**
 * One fixed budget page: every look that rebuilds at or under the cap — the
 * swap total, or the worn total where no swap is found yet. Cheapest first.
 */
export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return BUDGET_CAPS.map((cap) => ({ bucket: budgetSlug(cap) }));
}

async function load(bucket: string) {
  const cap = budgetCapFromSlug(bucket);
  if (!cap) return undefined;
  const [outfits, pages] = await Promise.all([getPublishedOutfits(), getBudgetPages()]);
  const looks = looksUnder(outfits, cap).sort((a, b) => (budgetPrice(a) ?? 0) - (budgetPrice(b) ?? 0));
  return { cap, looks, record: pages.find((page) => page.cap === cap) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).bucket);
  if (!data) return {};
  const { cap, looks, record } = data;
  const photo = looks[0]?.images?.[0];
  return pageMetadata({
    title: hubTitle(record, budgetHeadline(cap)),
    absoluteTitle: true,
    description: hubDescription(record, budgetDescription(cap, looks.length)),
    path: `/budget/${budgetSlug(cap)}`,
    images: photo ? [{ url: photo.url, alt: photo.alt ?? `A celebrity look ${budgetLabel(cap).toLowerCase()}` }] : undefined,
    index: hubIndexable({ looks: looks.length, introWords: wordCount(record?.intro) }),
  });
}

export default async function BudgetBucketPage({ params }: Props) {
  const data = await load((await params).bucket);
  if (!data) notFound();
  const { cap, looks, record } = data;
  const path = `/budget/${budgetSlug(cap)}`;
  const url = `${site.url}${path}`;
  const heading = hubTitle(record, budgetHeadline(cap));

  const structuredData = jsonLd([
    {
      "@type": "CollectionPage",
      "@id": `${url}#page`,
      url,
      name: heading,
      description: hubDescription(record, budgetDescription(cap, looks.length)),
      isPartOf: { "@id": `${site.url}#website` },
      inLanguage: "en-IN",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: looks.length,
        itemListElement: looks.map((outfit, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${site.url}/outfits/${outfitSlug(outfit)}`,
        })),
      },
    },
    breadcrumbs(url, [
      { name: "Home", path: "/" },
      { name: "Budget", path: "/budget" },
      { name: budgetLabel(cap), path },
    ]),
  ]);

  return (
    <>
      <Nav active="budget" />
      <main className={styles.page}>
        <div className={styles.shell}>
          <nav className={styles.crumb} aria-label="Breadcrumb">
            <Link href="/">Home</Link>›<Link href="/budget">Budget</Link>›<span>{budgetLabel(cap)}</span>
          </nav>
          <header className={styles.head}>
            <p className={styles.eyebrow}>
              {looks.length} {looks.length === 1 ? "look" : "looks"} · {budgetLabel(cap)}
            </p>
            <h1>{heading}</h1>
            <HubIntro paragraphs={record?.intro} />
          </header>
          {looks.length ? (
            <HubLooks title={`Looks ${budgetLabel(cap).toLowerCase()}, cheapest first`} outfits={looks} />
          ) : (
            <p className={styles.empty}>No decoded look rebuilds {budgetLabel(cap).toLowerCase()} yet.</p>
          )}
          <section className={styles.section}>
            <h2>Other budgets</h2>
            <div className={styles.list}>
              {BUDGET_CAPS.filter((other) => other !== cap).map((other) => (
                <Link href={`/budget/${budgetSlug(other)}`} key={other}>
                  <b>{budgetLabel(other)}</b>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <MobileTabs active="budget" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
    </>
  );
}
