import { pricing, type Outfit } from "@/lib/types";

/**
 * The fixed budget pages: /budget/under-3000 and so on.
 *
 * A look's budget price is what it costs to rebuild — the swap total — or,
 * when no swap has been found, what it cost as worn. Each page lists every
 * look at or under its cap, so the ₹5,000 page includes the ₹3,000 looks; a
 * look links to the smallest bucket it fits.
 */
export const BUDGET_CAPS = [3000, 5000, 10000, 25000] as const;
export type BudgetCap = (typeof BUDGET_CAPS)[number];

export const budgetSlug = (cap: number) => `under-${cap}`;

export const budgetCapFromSlug = (slug: string): BudgetCap | undefined => {
  const cap = Number(slug.match(/^under-(\d+)$/)?.[1]);
  return (BUDGET_CAPS as readonly number[]).includes(cap) ? (cap as BudgetCap) : undefined;
};

export const budgetLabel = (cap: number) => `Under ₹${cap.toLocaleString("en-IN")}`;

/** What a look costs for budget purposes, or null when nothing is priced. */
export function budgetPrice(outfit: { items: Outfit["items"] }): number | null {
  const money = pricing(outfit);
  if (money.anySwapped) return money.swapTotal;
  if (money.anyPriced) return money.wornTotal;
  return null;
}

/** The smallest bucket a look fits, or undefined above the top cap. */
export function budgetBucket(outfit: { items: Outfit["items"] }): BudgetCap | undefined {
  const price = budgetPrice(outfit);
  return price === null ? undefined : BUDGET_CAPS.find((cap) => price <= cap);
}

export const looksUnder = (outfits: Outfit[], cap: number) =>
  outfits.filter((outfit) => {
    const price = budgetPrice(outfit);
    return price !== null && price <= cap;
  });
