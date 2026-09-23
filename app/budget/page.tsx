import type { Metadata } from "next";
import { BudgetExplorer } from "@/components/budget/BudgetExplorer";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { budgetTiers, completeLooks } from "@/lib/archive";
import { getPublishedOutfits } from "@/lib/db/content";
import { inr } from "@/lib/format";
import { MIN_LOOKS_FOR_BUDGET_TIERS } from "@/lib/thresholds";
import { archiveCards, breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";

/**
 * The title and description used to promise ₹2,000, ₹5,000 and ₹10,000. Those
 * three figures were never computed from anything — the page's real tiers come
 * from the spread of what the archive's complete looks actually cost, so the
 * search result was advertising ceilings the page did not have.
 *
 * Built from the same `budgetTiers()` the page and the homepage tiles use.
 * Below MIN_LOOKS_FOR_BUDGET_TIERS the tiers are two or three prices rounded
 * off rather than a spread worth naming, so the wording stays general instead.
 */
export async function generateMetadata(): Promise<Metadata> {
  const outfits = await getPublishedOutfits();
  const tiers = budgetTiers(outfits);
  const caps = tiers.map((tier) => inr(tier.cap));
  // Every tier is derived from the same set of complete looks, so the gate is
  // on how many of those exist — not on any one tier's own count, which is
  // cumulative and would read differently at each ceiling.
  const nameable =
    tiers.length > 0 && completeLooks(outfits).length >= MIN_LOOKS_FOR_BUDGET_TIERS;

  if (!nameable) {
    return pageMetadata({
      title: "Celebrity-Inspired Outfits by Budget",
      absoluteTitle: true,
      description:
        "Start from what you can spend, not from the celebrity. Set a ceiling and see the complete celebrity looks the archive can rebuild inside it — every piece priced and linked.",
      path: "/budget",
      images: archiveCards(outfits),
    });
  }

  const list = `${caps.slice(0, -1).join(", ")} & ${caps[caps.length - 1]}`;
  return pageMetadata({
    title: `Celebrity-Inspired Outfits Under ${list}`,
    absoluteTitle: true,
    description:
      `Start from what you can spend. Complete celebrity-inspired outfits under ` +
      `${caps.join(", ")} — every piece priced and linked.`,
    path: "/budget",
    images: archiveCards(outfits),
  });
}

/** `?budget=` lets the homepage tiles open the slider where you clicked
 *  instead of dropping everyone at the same default. */
export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ budget?: string }> }) {
  const [outfits, query] = await Promise.all([getPublishedOutfits(), searchParams]);
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
