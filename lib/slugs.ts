import type { Celebrity, Occasion, Outfit } from "@/lib/types";

/** Slug helpers. Pure, so both the seed and the app agree on every URL. */

export const nameSlug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/**
 * The editor's own slug wins when there is one, so the URL and the storage
 * folder for a look are the same string they typed. Looks saved before the
 * field existed keep the derived slug their links already use.
 */
export const outfitSlug = (outfit: Pick<Outfit, "celebrity" | "event" | "date"> & { slug?: string }) =>
  outfit.slug?.trim()
    ? nameSlug(outfit.slug)
    : nameSlug(`${outfit.celebrity}-${outfit.event}-${outfit.date}`);

export const celebritySlug = (celebrity: Celebrity) => nameSlug(celebrity.name);

export const occasionSlug = (occasion: Occasion) => nameSlug(occasion.name);
