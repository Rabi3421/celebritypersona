import { leadPiece, type Outfit } from "@/lib/types";

/** Screen readers and image search both do best with alt text under this. */
export const ALT_LIMIT = 125;

/**
 * The alt text a photo gets when nobody has written one:
 *
 *     {Celebrity} wearing the {lead piece} by {label}
 *
 * Built only from fields somebody typed. Never a colour, a fabric or a mood the
 * fields do not state — nothing here has seen the picture, and a description
 * invented for a reader who cannot see it is the same failure as a price
 * invented from nothing.
 *
 * Every photo of a look gets the same line. A later photo would earn a word of
 * its own only if the record said something about it (a pose, a detail shot),
 * and it does not; "photo 3 of 5" tells a reader nothing the gallery does not.
 *
 * The label falls back to the swap's when the original was never identified,
 * because that is still a real label on a real piece. "the", because piece
 * names are product names and are as often plural ("… Platform Heels") as not.
 */
export function suggestPhotoAlt(
  outfit: Pick<Outfit, "celebrity" | "event" | "items" | "leadPieceId">,
): string {
  const lead = leadPiece(outfit);
  const label = lead ? (lead.wornBrand ?? lead.swapBrand) : undefined;
  const piece = lead?.name.trim();

  const candidates = [
    piece && label && `${outfit.celebrity} wearing the ${piece} by ${label}`,
    piece && `${outfit.celebrity} wearing the ${piece}`,
    // A look with no pieces yet still says who and where.
    `${outfit.celebrity} at ${outfit.event}`,
  ].filter((value): value is string => Boolean(value));

  const fits = candidates.find((line) => line.length <= ALT_LIMIT);
  return fits ?? candidates[candidates.length - 1].slice(0, ALT_LIMIT);
}
