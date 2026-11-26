import type { OutfitItem } from "@/lib/types";

/**
 * Piece ids must be unique across every look: a Buy button is /go/<piece id>,
 * and the click route sends it to the first look that has that piece. Two
 * looks sharing an id means one look's buttons open the other's shop.
 *
 * Given the ids already used by OTHER looks, gives any clashing piece here a
 * fresh id (and any piece repeated within this look). The older look keeps the
 * id, so its click history stays with it. `leadPieceId` follows its piece.
 */
export function withUniquePieceIds<T extends { items: OutfitItem[]; leadPieceId?: string }>(
  look: T,
  takenElsewhere: Set<string>,
  newId: () => string,
): { look: T; changed: number } {
  const seen = new Set<string>();
  let changed = 0;
  let lead = look.leadPieceId;
  let leadMoved = false;
  const items = look.items.map((item) => {
    if (!item.id || (!takenElsewhere.has(item.id) && !seen.has(item.id))) {
      if (item.id) seen.add(item.id);
      return item;
    }
    changed++;
    const id = newId();
    seen.add(id);
    // The lead names the first piece that had this id in the look.
    if (!leadMoved && look.leadPieceId === item.id) {
      lead = id;
      leadMoved = true;
    }
    return { ...item, id };
  });
  return { look: { ...look, items, ...(lead !== undefined ? { leadPieceId: lead } : {}) }, changed };
}
