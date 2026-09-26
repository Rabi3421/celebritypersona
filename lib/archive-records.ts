import type { Brand, Celebrity, Occasion, Outfit } from "@/lib/types";
import { outfitOccasions } from "@/lib/types";

/**
 * Names the outfits use — celebrities, occasions and labels — that have no
 * record of their own.
 *
 * The public pages already work without one — `celebrityViews` and
 * `occasionViews` stand in a virtual row — but a virtual row has nowhere to
 * keep anything an editor writes: an intro, a search title, a keyword. So a
 * record is created for every name, as soon as a look uses it.
 *
 * Matching is case-insensitive, like everywhere else two archive names meet;
 * the spelling kept is the first one the outfits use.
 */
export function missingRecords(
  records: {
    celebrities: Pick<Celebrity, "name">[];
    occasions: Pick<Occasion, "name">[];
    brands: Pick<Brand, "name">[];
  },
  outfits: Pick<Outfit, "celebrity" | "occasion" | "occasions" | "items">[],
): { celebrities: string[]; occasions: string[]; brands: string[] } {
  const missing = (known: { name: string }[], names: string[]) => {
    const seen = new Set(known.map((record) => record.name.trim().toLowerCase()));
    return names.filter((name) => {
      const key = name.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  return {
    celebrities: missing(records.celebrities, outfits.map((outfit) => outfit.celebrity)),
    occasions: missing(records.occasions, outfits.flatMap(outfitOccasions)),
    brands: missing(
      records.brands,
      outfits.flatMap((outfit) =>
        outfit.items.flatMap((item) => [item.wornBrand, item.swapBrand].filter((name): name is string => Boolean(name))),
      ),
    ),
  };
}

/**
 * A new occasion record, holding exactly what the virtual row showed — filed
 * under Everyday, with no description or colours yet — so creating it changes
 * nothing on the page until an editor fills it in.
 */
export const blankOccasion = (id: number, name: string): Occasion => ({
  id,
  name,
  group: "Everyday",
  peak: "",
  description: "",
  colours: [],
});

/** A new celebrity record: the name, nothing else. The page's bio keeps
 *  falling back to the generated one until an editor writes one. */
export const blankCelebrity = (id: number, name: string): Celebrity => ({ id, name });

/** A new brand record: the name, nothing else. */
export const blankBrand = (id: number, name: string): Brand => ({ id, name });
