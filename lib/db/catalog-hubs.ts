import type { Db, MongoClient, ClientSession } from "mongodb";
import type { Celebrity, Occasion, Outfit, HubSeo } from "@/lib/types";
import { outfitOccasions } from "@/lib/types";
import { nameSlug, outfitSlug } from "@/lib/slugs";
import { archiveIdentity, archiveName } from "@/lib/archive-name";
import { CatalogSaveError } from "@/lib/db/catalog-errors";
import { catalogTransaction, nextCatalogId } from "@/lib/db/catalog-transaction";
import { resolveArchiveName } from "@/lib/db/catalog-identity";
import { rememberCatalogSlug } from "@/lib/db/catalog-redirects";

type Hub = "celebrities" | "occasions";
type HubInput = Omit<Celebrity, "id"> | Omit<Occasion, "id">;
type Context = { client: MongoClient; db: Db };
export function hubWrite<T extends HubSeo & { intro?: string[]; bio?: string[] }>(input: T) {
  const cleared = (["seoTitle", "seoDescription", "primaryKeyword"] as const).filter((key) => !input[key]);
  const present = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
  return { $set: { ...present, updatedAt: new Date().toISOString() }, ...(cleared.length ? { $unset: Object.fromEntries(cleared.map((key) => [key, "" as const])) } : {}) };
}

async function renameOutfits(db: Db, session: ClientSession, field: "celebrity" | "occasion", from: string, to: string) {
  if (from === to) return 0;
  const collection = db.collection<Outfit>("outfits");
  const outfits = await collection.find({}, { session }).toArray();
  const matches = (s: string) => archiveIdentity(s) === archiveIdentity(from);
  const affected = outfits.filter((o) => matches(o[field]) || (field === "occasion" && (o.occasions ?? []).some(matches)));
  for (const outfit of affected) {
    const slug = outfitSlug(outfit);
    if (outfits.some((o) => o.id !== outfit.id && outfitSlug(o) === slug)) throw new CatalogSaveError("A legacy slug conflict prevents this rename. Review the existing URLs first.");
    const renamed = (name: string) => matches(name) ? to : name;
    await collection.updateOne({ id: outfit.id }, { $set: { [field]: renamed(outfit[field]), slug,
      ...(field === "occasion" ? { occasions: outfitOccasions({ occasion: renamed(outfit.occasion), occasions: (outfit.occasions ?? []).map(renamed) }) } : {}),
    } }, { session });
  }
  return affected.length;
}

export async function persistHubCreate({ client, db, collection, input }: Context & { collection: Hub; input: HubInput }) {
  return catalogTransaction(client, db, async (session) => {
    const existing = await resolveArchiveName(db, collection, input.name, session);
    if (existing) throw new CatalogSaveError(`This name already belongs to record #${existing.id}. Edit or explicitly merge that record instead.`, "name");
    const id = await nextCatalogId(db, collection, session);
    await db.collection(collection).insertOne({ ...input, name: archiveName(input.name), id, updatedAt: new Date().toISOString() }, { session });
    return id;
  });
}
export async function persistHubEdit({ client, db, collection, id, input }: Context & { collection: Hub; id: number; input: HubInput }) {
  return catalogTransaction(client, db, async (session) => {
    const records = db.collection<Celebrity | Occasion>(collection);
    const previous = await records.findOne({ id }, { session });
    if (!previous) throw new CatalogSaveError("This archive record no longer exists.");
    const existing = await resolveArchiveName(db, collection, input.name, session);
    if (existing && existing.id !== id) throw new CatalogSaveError("Another record already uses this name. Use the explicit rename/merge action instead.", "name");
    const name = archiveName(input.name);
    await records.updateOne({ id }, hubWrite({ ...input, name }), { session });
    const kind = collection === "celebrities" ? "celebrity" : "occasion";
    await rememberCatalogSlug(db, session, kind, nameSlug(previous.name), nameSlug(name));
    await renameOutfits(db, session, kind, previous.name, name);
  });
}
/** Only an explicit merge operation can delete a source hub. */
export async function persistHubRename({ client, db, collection, from, to }: Context & { collection: Hub; from: string; to: string }) {
  return catalogTransaction(client, db, async (session) => {
    const records = db.collection<Celebrity | Occasion>(collection);
    const source = await resolveArchiveName(db, collection, from, session);
    const target = await resolveArchiveName(db, collection, to, session);
    const name = target?.name ?? archiveName(to);
    const merged = Boolean(source && target && source.id !== target.id);
    if (merged) await records.deleteOne({ id: source!.id }, { session });
    else if (source) await records.updateOne({ id: source.id }, { $set: { name } }, { session });
    const kind = collection === "celebrities" ? "celebrity" : "occasion";
    await rememberCatalogSlug(db, session, kind, nameSlug(from), nameSlug(name));
    const looks = await renameOutfits(db, session, kind, from, name);
    return { looks, merged };
  });
}
