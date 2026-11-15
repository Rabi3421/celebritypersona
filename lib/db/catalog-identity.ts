import type { ClientSession, Db } from "mongodb";
import { CatalogSaveError } from "@/lib/db/catalog-errors";
import { blankBrand, blankCelebrity, blankOccasion, missingRecords } from "@/lib/archive-records";
import { nextCatalogId } from "@/lib/db/catalog-transaction";
import { outfitOccasions, type Outfit } from "@/lib/types";
import { archiveName, archiveIdentity } from "@/lib/archive-name";

export type HubCollection = "celebrities" | "occasions" | "brands";
type RecordName = { id: number; name: string };

export async function resolveArchiveName(db: Db, collection: HubCollection, value: string, session: ClientSession): Promise<RecordName | null> {
  const name = archiveName(value);
  if (!name) throw new CatalogSaveError(`${collection}: a nonempty name is required.`);
  const rows = await db.collection<RecordName>(collection).find({}, { session }).toArray();
  const matches = rows.filter((r) => typeof r.name === "string" && archiveIdentity(r.name) === archiveIdentity(name));
  if (matches.length > 1) throw new CatalogSaveError(`${collection}: more than one legacy record matches this normalized name. Review identity before saving.`);
  if (matches[0]) return matches[0]; // Preserve the existing record's spelling.
  const collationMatch = await db.collection<RecordName>(collection).findOne({ name }, { session, collation: { locale: "en", strength: 2 } });
  if (collationMatch) throw new CatalogSaveError(`${collection}: the name index treats this as equal to another name, but identity normalization does not. Confirm the identity manually.`);
  return null;
}

export async function ensureOutfitRecords(db: Db, input: Omit<Outfit, "id" | "worn" | "swap">, session: ClientSession, approvedRelated?: string) {
  // Keep the import approval contract based on the exact proposed insertion list.
  const normalized = { ...input, celebrity: archiveName(input.celebrity), occasion: archiveName(input.occasion),
    occasions: outfitOccasions(input).map(archiveName),
    items: input.items.map((i) => ({ ...i, ...(i.wornBrand ? { wornBrand: archiveName(i.wornBrand) } : {}), ...(i.swapBrand ? { swapBrand: archiveName(i.swapBrand) } : {}) })),
  };
  const actualMissing: Record<HubCollection, string[]> = { celebrities: [], occasions: [], brands: [] };
  const planned = missingRecords({ celebrities: [], occasions: [], brands: [] }, [normalized]);
  for (const collection of ["celebrities", "occasions", "brands"] as const) {
    for (const name of planned[collection]) if (!await resolveArchiveName(db, collection, name, session)) actualMissing[collection].push(name);
  }
  if (approvedRelated !== undefined && Object.values(actualMissing).some((names) => names.length) && approvedRelated !== JSON.stringify(actualMissing)) {
    throw new CatalogSaveError("Approve the current list of new celebrity, occasion and brand records before saving.");
  }
  async function ensure(collection: HubCollection, value: string) {
    const existing = await resolveArchiveName(db, collection, value, session);
    if (existing) return existing.name;
    const name = archiveName(value);
    const id = await nextCatalogId(db, collection, session);
    const record = collection === "celebrities" ? blankCelebrity(id, name) : collection === "occasions" ? blankOccasion(id, name) : blankBrand(id, name);
    await db.collection(collection).insertOne(record, { session });
    return name;
  }
  normalized.celebrity = await ensure("celebrities", normalized.celebrity);
  normalized.occasion = await ensure("occasions", normalized.occasion);
  const occasions = [];
  for (const name of normalized.occasions) occasions.push(await ensure("occasions", name));
  normalized.occasions = outfitOccasions({ occasion: normalized.occasion, occasions });
  for (const item of normalized.items) {
    if (item.wornBrand) item.wornBrand = await ensure("brands", item.wornBrand);
    if (item.swapBrand) item.swapBrand = await ensure("brands", item.swapBrand);
  }
  return normalized;
}
