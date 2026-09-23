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

/**
 * The slug a new look should get.
 *
 * One formula, so the archive stops accumulating three shapes of URL:
 *
 *     <celebrity>-<key piece>-<label>        sonal-chauhan-diva-pink-cape-set-aum-ashima-asit
 *
 * The key piece is the dearest identified piece, falling back to the first —
 * it is what the look is *about*, and it is what somebody searches. The label
 * is appended when we have it, because "pink cape set" is a description and
 * "pink cape set aum ashima asit" is a product.
 *
 * No date. Dates were in the derived slug only because the derivation needed
 * something unique, and they make a URL look stale the moment the year turns.
 * One is appended here only when the slug would otherwise collide with a look
 * that already exists.
 *
 * This is a suggestion for the create form, not a rule the app enforces: an
 * editor's own slug always wins, and nothing existing is ever rewritten,
 * because a live URL is a promise to everyone who linked to it.
 */
export function suggestOutfitSlug(
  outfit: {
    celebrity: string;
    event: string;
    date?: string;
    items?: { name: string; wornBrand?: string; worn?: number; swapBrand?: string }[];
  },
  taken: readonly string[] = [],
): string {
  const items = outfit.items?.filter((item) => item.name?.trim()) ?? [];

  // The dearest identified piece is the one the look is known for.
  const lead =
    [...items].sort((a, b) => (b.worn ?? 0) - (a.worn ?? 0))[0] ?? undefined;
  const label = lead?.wornBrand ?? lead?.swapBrand;

  const base = nameSlug(
    [outfit.celebrity, lead?.name ?? outfit.event, label].filter(Boolean).join(" "),
  );
  if (!base) return "";

  const used = new Set(taken);
  if (!used.has(base)) return base;

  // Only now does a date earn its place, and only the day itself.
  const dated = outfit.date ? nameSlug(`${base} ${outfit.date}`) : base;
  if (!used.has(dated)) return dated;

  for (let suffix = 2; suffix < 50; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return base;
}

/**
 * Whether a stored slug matches the formula above.
 *
 * Used only to report on the archive. A slug that does not conform is not
 * broken — it is a URL people may have linked to, and changing it needs a
 * redirect and a decision, not a migration.
 */
export const slugFitsFormula = (
  outfit: Parameters<typeof suggestOutfitSlug>[0] & { slug?: string },
) => (outfit.slug?.trim() ? nameSlug(outfit.slug) : "") === suggestOutfitSlug(outfit);
