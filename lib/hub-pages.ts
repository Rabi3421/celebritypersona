import type { BrandView, CelebrityView, OccasionView } from "@/lib/archive";
import { budgetLabel } from "@/lib/budget";
import { plural } from "@/lib/format";

/**
 * The generated titles and descriptions of the hub pages — what a celebrity,
 * occasion, brand or budget page says in a search result when the editor has
 * not written their own. Shared by the pages and by the admin forms' previews,
 * so the preview shows the fallback the page will actually use.
 */

/**
 * What an archive page is for, said the way people search for it.
 *
 * The searches these pages can win are "<name> outfits", "<name> dress",
 * "<name> airport look", "<name> style" — so the title leads with the name and
 * the words, not with "Style Archive". The look count stays in the description
 * where it is useful rather than in the blue link where it costs width.
 */
export function celebrityDescription(celebrity: CelebrityView) {
  const { looks, occasions, brands } = celebrity.stats;
  const her = celebrity.name;

  if (looks === 0) {
    return `${her} outfits, decoded piece by piece — the brand of every item, the price where we could confirm it, and an affordable alternative. No look is decoded yet; new ones are added as they are published.`;
  }

  const events = occasions.slice(0, 3).map((occasion) => occasion.name.toLowerCase());
  const labels = brands.slice(0, 2).map((brand) => brand.name);
  const where = events.length ? ` Covering ${events.join(", ")} looks.` : "";
  const who = labels.length ? ` Labels worn include ${labels.join(" and ")}.` : "";
  return `${plural(looks, "look")} of ${her}'s decoded piece by piece — every item identified, priced where confirmed, with affordable alternatives.${where}${who}`.slice(
    0,
    300,
  );
}

export function celebrityHeadline(celebrity: CelebrityView) {
  const { looks } = celebrity.stats;
  // "Outfits, Dresses & Style" is the phrase set these archives compete on;
  // the count is only worth the width once there is a real archive behind it.
  return looks >= 3
    ? `${celebrity.name} Outfits, Dresses & Style — ${plural(looks, "Look")} Decoded`
    : `${celebrity.name} Outfits, Dresses & Style`;
}

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/**
 * Occasion pages compete for "sangeet outfit ideas", "what to wear to a
 * mehendi", "Diwali outfit ideas" — a question, not a category. The title
 * asks it in the words people use; the description answers with what the page
 * actually holds rather than a promise it may not be able to keep.
 */
export function occasionHeadline(occasion: OccasionView) {
  const name = occasion.name;
  const lower = name.toLowerCase();
  // Occasions that are places or events rather than ceremonies read wrong as
  // "Sangeet Outfit Ideas" would read right.
  const asPlace = ["Airport", "Red carpet", "Promo tour", "Casual"].includes(name);
  return asPlace
    ? `Celebrity ${lower} Looks — Outfits, Brands & Prices`
    : `${name} Outfit Ideas — Celebrity Looks, Prices & Affordable Swaps`;
}

export function occasionDescription(occasion: OccasionView) {
  const { looks, swapFrom, averageWorn } = occasion.stats;
  const lower = occasion.name.toLowerCase();

  if (looks === 0) {
    return `${occasion.name} outfit ideas taken from celebrity looks, decoded piece by piece with brands, prices and affordable alternatives. No ${lower} look is decoded yet.`;
  }

  const from = swapFrom === null ? "" : ` Complete looks rebuild from ${inr(swapFrom)}.`;
  const worn = averageWorn === null ? "" : ` The originals average ${inr(averageWorn)}.`;
  return `What to wear to ${lower === "airport" ? "the airport" : `a ${lower}`}, taken from ${plural(looks, "celebrity look")} decoded piece by piece — every item identified and priced, with affordable alternatives.${from}${worn}`.slice(
    0,
    300,
  );
}

/**
 * Brand pages answer "<label> celebrity outfits", "who wore <label>" and, for
 * the high-street labels the swaps point at, "<label> celebrity dupes".
 */
export function brandHeadline(brand: BrandView) {
  const { worn, swapped } = brand.stats;
  return worn >= swapped
    ? `${brand.name} Celebrity Outfits — Who Wore It & Prices`
    : `${brand.name} Celebrity Lookalikes — Affordable Swaps`;
}

export function brandDescription(brand: BrandView) {
  const { looks, worn, swapped } = brand.stats;
  if (looks === 0) return `Celebrity looks featuring ${brand.name}, decoded piece by piece with prices and where to buy.`;
  const parts = [
    worn ? `${plural(worn, "celebrity look")} wearing ${brand.name}` : "",
    swapped ? `${plural(swapped, "look")} where ${brand.name} is the affordable swap` : "",
  ].filter(Boolean);
  return `${parts.join(", and ")} — every piece identified and priced in ₹, with where to buy it.`;
}

export function budgetHeadline(cap: number) {
  return `Celebrity Outfits ${budgetLabel(cap)} — Decoded Looks & Swaps`;
}

export function budgetDescription(cap: number, looks: number) {
  return looks
    ? `${plural(looks, "celebrity look")} you can rebuild ${budgetLabel(cap).toLowerCase()}, decoded piece by piece with ₹ prices and where to buy every swap.`
    : `Celebrity looks you can rebuild ${budgetLabel(cap).toLowerCase()}, decoded piece by piece with ₹ prices and where to buy them.`;
}
