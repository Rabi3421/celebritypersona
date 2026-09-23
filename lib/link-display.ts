import { isMonetised, pieceLink, type OutfitItem, type PieceSide } from "@/lib/types";

const inrFormat = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

/**
 * How a piece's link reads on the page.
 *
 * Kept out of the component so it can be exercised on its own: the five link
 * states are the whole point of the redesign, and "check it by clicking a tab
 * and looking" is not a way to know that four of them are right.
 */

/** Which half of a piece the "As worn" / "The swap" tabs are showing. */
export type PriceMode = "worn" | "swap";

/**
 * What a piece costs on the side being shown.
 *
 * Both the quick view and the detail page printed an em dash here, which is a
 * mark standing in for data — and it appeared most often on the side the
 * reader had *not* asked about, so a look with a swap and no confirmed
 * original showed "—" under "As worn" as though the price were missing rather
 * than never established. The site already has words for both states.
 */
export function piecePrice(item: OutfitItem, mode: PriceMode): string {
  const value = mode === "worn" ? item.worn : item.swap;
  if (value !== undefined) return inrFormat(value);
  return mode === "worn" ? "Price unconfirmed" : "No swap yet";
}

export const sideOf = (mode: PriceMode): PieceSide => (mode === "worn" ? "original" : "swap");

/**
 * The little status line beside a piece, and whether it reads as archived.
 *
 * Every state a link can be in says which it is, in the reader's words. The
 * only one that used to be distinguishable was sold out; "link pending" was
 * printed next to a Buy button, and a dead link was indistinguishable from a
 * live one until you clicked it.
 */
export function tagFor(item: OutfitItem, mode: PriceMode): { text: string; archived: boolean } {
  const side = sideOf(mode);
  const link = pieceLink(item, side);
  const named = side === "original" ? item.wornBrand : item.swapBrand;
  /**
   * "Exact" is a claim that this is the very piece she wore, and it was
   * printed whether or not the label had been identified. A piece we have not
   * confirmed cannot be called exact — that is the difference between
   * reporting and guessing, and it is the one the whole site rests on.
   */
  const prefix = side === "swap" ? "Similar" : named ? "Exact" : "Unidentified";

  if (side === "swap" && !named) return { text: "Still looking", archived: false };

  switch (link?.status) {
    case "ok":
    case "unverified":
      // The disclosure page promises that outbound commercial links are
      // marked. rel="sponsored" marks them for a crawler; this marks them for
      // a person, in the row the link is actually in, using the word rather
      // than a symbol they would have to go and look up.
      return {
        text: `${prefix} · buy it${isMonetised(link) ? " · affiliate" : ""}`,
        archived: false,
      };
    case "sold_out":
      return { text: `${prefix} · sold out`, archived: true };
    case "dead":
      // Said plainly rather than hidden: the piece is still the right piece,
      // and a reader who knows the link is gone can search for it themselves.
      return { text: `${prefix} · link removed`, archived: true };
    default:
      break;
  }

  if (side === "original" && item.worn === undefined) {
    return { text: "Exact · price unconfirmed", archived: true };
  }
  return { text: `${prefix} · link coming soon`, archived: true };
}
