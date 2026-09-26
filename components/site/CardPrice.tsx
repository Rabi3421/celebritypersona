import { pricing, type OutfitItem } from "@/lib/types";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export type CardPriceValues = {
  /** Total of the originals we could price, or null when none were. */
  worn: number | null;
  /** Total of the swaps found, or null when there are none yet. */
  swap: number | null;
  /** Every piece has a swap, so the two totals cover the same pieces. */
  complete: boolean;
  swapped?: number;
  pieces?: number;
};

export const cardPriceValues = (outfit: { items: OutfitItem[] }): CardPriceValues => {
  const money = pricing(outfit);
  return {
    worn: money.anyPriced ? money.wornTotal : null,
    swap: money.anySwapped ? money.swapTotal : null,
    complete: money.allSwapped,
    swapped: money.swapped,
    pieces: money.pieces,
  };
};

/**
 * A look's prices on a card, as the parent's own <s>, <b>, <em> and <span>.
 *
 * The original is struck through only when a complete swap sits beside it.
 * Cards used to strike the worn price whatever was next to it, so "₹9,600
 * crossed out, No swap yet" read as a discount on a look nobody had found an
 * alternative for — and a partial swap's total, set against an original total
 * covering more pieces, read as a saving it was not.
 */
export function CardPrice({ worn, swap, complete, swapped, pieces }: CardPriceValues) {
  if (worn !== null && swap !== null && complete) {
    return (
      <>
        <s>{inr.format(worn)}</s>
        <b>{inr.format(swap)}</b>
      </>
    );
  }
  const partial = swap !== null && !complete && swapped && pieces ? ` · ${swapped} of ${pieces} pieces` : "";
  return (
    <>
      {worn === null ? <em>Price unconfirmed</em> : <span>{inr.format(worn)} as worn</span>}
      {swap === null ? <em>No swap yet</em> : <b>{inr.format(swap)}{partial}</b>}
    </>
  );
}
