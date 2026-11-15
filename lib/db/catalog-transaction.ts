import type { ClientSession, Db, MongoClient } from "mongodb";
import { devWriteBlock } from "@/lib/dev-write-guard";
import { isLocalDatabase } from "@/lib/prod-guard";
import { CatalogSaveError, catalogFailure } from "@/lib/db/catalog-errors";
import { requireCatalogIndexes } from "@/lib/db/catalog-indexes";

export const CATALOG_STATE = "catalogWriteState";
export function assertCatalogEnvironment(env: Record<string, string | undefined> = process.env) {
  const block = devWriteBlock(env);
  if (block) throw new CatalogSaveError(block);
}
export function assertImportEnvironment(env: Record<string, string | undefined> = process.env) {
  if (env.VERCEL_ENV === "preview") throw new CatalogSaveError("Imported draft writes are disabled on Vercel previews.");
  assertCatalogEnvironment(env);
  if (!isLocalDatabase(env.MONGODB_URI) && (env.VERCEL_ENV !== "production" || env.CP_OUTFIT_IMPORT_WRITES !== "enabled")) {
    throw new CatalogSaveError("Remote imported draft writes are disabled. Enable only on the approved production deployment after the database readiness review.");
  }
}

/** One shared write forces a fresh serial order for IDs and cross-look SEO
 * predicates. Snapshot transactions alone cannot prevent write skew. All I/O
 * in operation is sequential and retryable; external effects belong outside.
 */
export async function catalogTransaction<T>(client: MongoClient, db: Db, operation: (session: ClientSession) => Promise<T>, imports = false): Promise<T> {
  assertCatalogEnvironment();
  if (imports) assertImportEnvironment();
  await requireCatalogIndexes(db, imports);
  const ready = await db.collection<{ _id: string; version: number }>(CATALOG_STATE).findOne({ _id: "catalog" });
  if (!ready || !Number.isSafeInteger(ready.version) || ready.version < 0) throw new CatalogSaveError("Catalog write coordination is not provisioned. No records were written; an approved migration is required.");
  const session = client.startSession();
  try {
    return await session.withTransaction(async () => {
      // This MUST precede catalog reads, including first-publication checks.
      const lock = await db.collection<{ _id: string; version: number }>(CATALOG_STATE).updateOne({ _id: "catalog" }, { $inc: { version: 1 } }, { session });
      if (lock.matchedCount !== 1) throw new CatalogSaveError("Catalog write coordination disappeared. Reload before retrying.");
      return operation(session);
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary", timeoutMS: 8000, maxCommitTimeMS: 5000 });
  } catch (error) { throw catalogFailure(error); }
  finally { await session.endSession(); }
}

export async function nextCatalogId(db: Db, name: string, session: ClientSession) {
  const rows = await db.collection(name).find({}, { session, projection: { id: 1 } }).toArray();
  if (rows.some((r) => !Number.isSafeInteger(r.id) || r.id < 1)) throw new CatalogSaveError(`${name} has an invalid legacy numeric ID. Review it before creating records.`);
  const id = rows.reduce((max, r) => Math.max(max, r.id as number), 0) + 1;
  if (id > 999_999_999) throw new CatalogSaveError("Catalog numeric ID range requires manual review.");
  return id;
}
