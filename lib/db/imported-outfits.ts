/** Existing importer API delegates to the same catalog transaction as manual saves. */
import type { Db, MongoClient } from "mongodb";
import type { ImportProvenance } from "@/lib/outfit-research";
import { persistOutfit, type OutfitInput } from "@/lib/db/catalog-outfits";
import { requireCatalogIndexes } from "@/lib/db/catalog-indexes";
export { IMPORT_INDEXES } from "@/lib/db/catalog-indexes";
export { assertImportEnvironment } from "@/lib/db/catalog-transaction";
export { CatalogSaveError as ImportDraftRefused } from "@/lib/db/catalog-errors";
export const requireImportIndexes = (db: Db) => requireCatalogIndexes(db, true);

export async function persistImportedDraft(args: { client: MongoClient; db: Db; input: OutfitInput; provenance: ImportProvenance; approvedRelated: string; actor: string }) {
  return (await persistOutfit({ ...args, mode: "import" })).next.id;
}
