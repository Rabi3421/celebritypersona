import type { OutfitItem } from "@/lib/types";

/**
 * The editor posts budget swaps as plain text, so every save would reset their
 * links to "unverified". A link whose URL did not change keeps what the weekly
 * check learned about it (status, retailer, checked date).
 */
export function keepBudgetSwapStatus(items: OutfitItem[], before: OutfitItem[]): OutfitItem[] {
  return items.map((item) => {
    if (!item.budgetSwaps?.length) return item;
    const old = before.find((candidate) => candidate.id && candidate.id === item.id)?.budgetSwaps ?? [];
    return {
      ...item,
      budgetSwaps: item.budgetSwaps.map((swap) => {
        const match = old.find((candidate) => candidate.link?.url === swap.link.url);
        return match ? { ...swap, link: { ...swap.link, status: match.link.status, retailer: match.link.retailer, ...(match.link.checkedAt ? { checkedAt: match.link.checkedAt } : {}) } } : swap;
      }),
    };
  });
}
