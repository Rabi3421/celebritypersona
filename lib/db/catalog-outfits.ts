import { createHash } from "node:crypto";
import type { Db, MongoClient } from "mongodb";
import { canonicalJson } from "@/lib/seo-review/pack";
import { keywordOwners } from "@/lib/keyword-owners";
import { blockingChecks, seoChecks } from "@/lib/seo-checks";
import { hasSwap, hasWornPrice, isPublished, type Outfit } from "@/lib/types";
import { outfitSlug } from "@/lib/slugs";
import { canonicalProduct, instagramPost, researchDuplicates, type ImportProvenance } from "@/lib/outfit-research";
import { CatalogSaveError } from "@/lib/db/catalog-errors";
import { catalogTransaction, nextCatalogId } from "@/lib/db/catalog-transaction";
import { ensureOutfitRecords } from "@/lib/db/catalog-identity";
import { rememberCatalogSlug } from "@/lib/db/catalog-redirects";

export type OutfitInput = Omit<Outfit, "id" | "worn" | "swap">;
/** Detect changes by old tabs or maintenance without backfilling revisions. */
export function outfitVersion(outfit: object): string {
  const values = { ...outfit } as Record<string, unknown>;
  delete values._id;
  return createHash("sha256").update(canonicalJson(JSON.parse(JSON.stringify(values)))).digest("hex");
}
export type OutfitCommit = { previous?: Outfit; next: Outfit; replayed: boolean; refreshWarning?: boolean };
type Save = { client: MongoClient; db: Db; input: OutfitInput; actor: string;
  afterCommit?: (result: OutfitCommit) => Promise<void> | void;
} & ({ mode: "create"; requestKey: string } | { mode: "edit"; id: number; expectedVersion: string; slugUnlocked?: boolean } | { mode: "import"; provenance: ImportProvenance; approvedRelated: string });
const today = () => new Date().toISOString().slice(0, 10);

export async function persistOutfit(save: Save): Promise<OutfitCommit> {
  if (!save.actor || !["draft", "published"].includes(save.input.status ?? "")) throw new CatalogSaveError("A signed-in editor must choose Draft or Published.");
  if (save.mode === "create" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(save.requestKey)) throw new CatalogSaveError("This new-outfit form needs to be reloaded before saving. Preserve your unsaved draft first.");
  if (save.mode === "edit" && !/^[0-9a-f]{64}$/.test(save.expectedVersion)) throw new CatalogSaveError("Reload this editor to obtain its saved version. Your submitted values have been preserved.");
  let source: ImportProvenance | undefined;
  if (save.mode === "import") {
    const post = instagramPost(save.provenance.instagramUrl);
    if (!post || save.input.status !== "draft") throw new CatalogSaveError("Research imports can only create a new Draft.");
    if (save.input.items.some((i) => [i.worn, i.swap].some((p) => p !== undefined && (!Number.isSafeInteger(p) || p < 1)))) throw new CatalogSaveError("Imported prices must be safe positive whole INR amounts.");
    source = { ...save.provenance, instagramUrl: post, productUrl: canonicalProduct(save.provenance.productUrl), approvedBy: save.actor };
  }
  const result = await catalogTransaction(save.client, save.db, async (session): Promise<OutfitCommit> => {
    const collection = save.db.collection<Outfit>("outfits");
    const raw = save.db.collection<Outfit & { _id: string }>("outfits");
    const identity = save.mode === "edit" ? null : source
      ? `research:${createHash("sha256").update(source.instagramUrl).digest("hex")}`
      : `editor:${createHash("sha256").update(`${save.actor.trim().toLowerCase()}:${save.mode === "create" ? save.requestKey.toLowerCase() : ""}`).digest("hex")}`;
    if (identity) {
      const found = await raw.findOne({ _id: identity }, { session, projection: { _id: 0 } });
      if (found) return { next: found, replayed: true };
    }
    const all = await collection.find({}, { session, projection: { _id: 0 } }).toArray();
    const previous = save.mode === "edit" ? all.find((o) => o.id === save.id) : undefined;
    if (save.mode === "edit") {
      if (!previous) throw new CatalogSaveError("This outfit no longer exists. Nothing was recreated.");
      if (outfitVersion(previous) !== save.expectedVersion) throw new CatalogSaveError("Another editor or maintenance task changed this outfit. Reload and compare your preserved values before retrying.");
      if (previous.slugLockedAt && outfitSlug(previous) !== save.input.slug && !save.slugUnlocked) throw new CatalogSaveError("This published slug is locked. Unlock it explicitly before changing it.", "slug");
    }
    if (all.some((o) => o.id !== previous?.id && outfitSlug(o) === save.input.slug)) throw new CatalogSaveError("Another look already uses this slug", "slug");
    if (source && researchDuplicates(source.research, all).some((d) => d.blocked)) throw new CatalogSaveError("This Instagram post already has an outfit. Open the existing record.");
    const input = await ensureOutfitRecords(save.db, save.input, session, save.mode === "import" ? save.approvedRelated : undefined);
    const blockers = blockingChecks(seoChecks({ ...input, images: input.images ?? [], slug: input.slug ?? "", leadChosen: Boolean(input.leadPieceId) }, { id: previous?.id, owners: keywordOwners(all) }));
    if (input.status === "published" && !(previous && isPublished(previous)) && blockers.length) throw new CatalogSaveError(`Not published: ${blockers.map((c) => c.label).join("; ")}. Fix the checks or save as Draft.`, "status");
    const totals = { worn: input.items.filter(hasWornPrice).reduce((sum, i) => sum + (i.worn ?? 0), 0), swap: input.items.filter(hasSwap).reduce((sum, i) => sum + (i.swap ?? 0), 0) };
    const id = previous?.id ?? await nextCatalogId(save.db, "outfits", session);
    const firstPublish = input.status === "published" && (!previous || previous.status === "draft")
      ? { publishedAt: previous?.publishedAt ?? today(), slugLockedAt: previous?.slugLockedAt ?? today() } : {};
    const set = { ...input, ...totals, ...firstPublish, ...(save.mode === "import" ? {} : { pricesCheckedAt: today() }), ...(source ? { researchImport: source } : {}) };
    if (!previous) {
      const next = { ...set, id } as Outfit;
      await raw.insertOne({ ...next, _id: identity! }, { session });
      return { next, replayed: false };
    }
    if (isPublished(previous) || previous.slugLockedAt) await rememberCatalogSlug(save.db, session, "outfit", outfitSlug(previous), input.slug ?? "");
    const unset = { image: "", isNew: "", ...Object.fromEntries([
      "seoTitle", "seoDescription", "primaryKeyword", "secondaryKeywords", "faqs", "leadPieceId",
    ].filter((key) => { const value = input[key as keyof OutfitInput]; return Array.isArray(value) ? !value.length : !value; }).map((key) => [key, ""])) } as Record<string, "">;
    const present = Object.fromEntries(Object.entries({ ...set, images: input.images ?? [] }).filter(([key, value]) => value !== undefined && !(key in unset)));
    await collection.updateOne({ id }, { $set: present, $unset: unset }, { session });
    const next = { ...previous, ...present } as Outfit;
    for (const key of Object.keys(unset)) delete (next as unknown as Record<string, unknown>)[key];
    return { previous, next, replayed: false };
  }, save.mode === "import");
  if (!result.replayed && save.afterCommit) {
    try { await save.afterCommit(result); }
    catch { result.refreshWarning = true; }
  }
  return result;
}
