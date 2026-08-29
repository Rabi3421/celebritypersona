import type { Celebrity, Occasion, Outfit } from "@/lib/types";

/** Slug helpers. Pure, so both the seed and the app agree on every URL. */

export const nameSlug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const outfitSlug = (outfit: Outfit) =>
  nameSlug(`${outfit.celebrity}-${outfit.event}-${outfit.date}`);

export const celebritySlug = (celebrity: Celebrity) => nameSlug(celebrity.name);

export const occasionSlug = (occasion: Occasion) => nameSlug(occasion.name);
