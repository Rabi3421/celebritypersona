import type { Metadata } from "next";
import { BudgetExplorer } from "@/components/budget/BudgetExplorer";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { getOutfits } from "@/lib/db/content";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";

export const metadata: Metadata = pageMetadata({
  title: "Celebrity-Inspired Outfits Under ₹2,000, ₹5,000 & ₹10,000",
  absoluteTitle: true,
  description:
    "Start from what you can spend. Complete celebrity-inspired outfits you can build under ₹2,000, ₹5,000 or ₹10,000 — every piece priced, linked and matched to the look it copies.",
  path: "/budget",
});

/** `?budget=` lets the homepage tiles open the slider where you clicked
 *  instead of dropping everyone at the same default. */
export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ budget?: string }> }) {
  const [outfits, query] = await Promise.all([getOutfits(), searchParams]);
  const requested = Number(query.budget);
  const initialBudget = Number.isFinite(requested) && requested > 0 ? requested : undefined;

  const structuredData = jsonLd([
    {
      "@type": "CollectionPage",
      "@id": `${site.url}/budget#page`,
      url: `${site.url}/budget`,
      name: "Celebrity-inspired outfits by budget",
      isPartOf: { "@id": `${site.url}#website` },
      inLanguage: "en-IN",
    },
    breadcrumbs(`${site.url}/budget`, [
      { name: "Home", path: "/" },
      { name: "Budget", path: "/budget" },
    ]),
  ]);

  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} /><Nav active="budget"/><BudgetExplorer outfits={outfits} initialBudget={initialBudget}/><Footer/><MobileTabs/><ScrollEffects/></>;}
