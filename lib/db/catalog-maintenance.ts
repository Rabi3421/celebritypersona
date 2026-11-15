import type { ClientSession, Db, MongoClient } from "mongodb";
import { catalogTransaction } from "@/lib/db/catalog-transaction";
import { outfitVersion } from "@/lib/db/catalog-outfits";
import { CatalogSaveError } from "@/lib/db/catalog-errors";

/** Apply a previously inspected maintenance plan atomically, only if its
 * source documents still match. Network lookups/backups stay outside retries. */
export async function catalogMaintenance<T>(client: MongoClient, db: Db,
  expected: { collection: string; documents: readonly object[] }[],
  operation: (session: ClientSession) => Promise<T>) {
  return catalogTransaction(client, db, async (session) => {
    for (const group of expected) for (const document of group.documents) {
      const source = document as Record<string, unknown>;
      if (!Number.isSafeInteger(source.id) || Number(source.id) < 1) throw new CatalogSaveError("Maintenance plan has no valid numeric record identity.");
      const current = await db.collection(group.collection).findOne({ id: source.id }, { session });
      if (!current || outfitVersion(current) !== outfitVersion(source)) throw new CatalogSaveError("Maintenance plan is stale. Run a new dry run; nothing was written.");
    }
    return operation(session);
  });
}
