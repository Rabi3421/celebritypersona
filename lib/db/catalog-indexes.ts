import type { Db } from "mongodb";
import { CatalogSaveError } from "@/lib/db/catalog-errors";

export const IMPORT_INDEXES = [
  { collection: "outfits", key: { id: 1 }, name: "outfit_id_unique" },
  { collection: "outfits", key: { slug: 1 }, name: "outfit_slug_unique", partialFilterExpression: { slug: { $type: "string" } } },
  { collection: "outfits", key: { "researchImport.instagramUrl": 1 }, name: "outfit_import_post_unique", partialFilterExpression: { "researchImport.instagramUrl": { $type: "string" } } },
  ...["celebrities", "occasions", "brands"].flatMap((collection) => [
    { collection, key: { id: 1 }, name: `${collection}_id_unique` },
    { collection, key: { name: 1 }, name: `${collection}_name_unique`, collation: { locale: "en", strength: 2 } },
  ]),
] as const;

export async function requireCatalogIndexes(db: Db, imports = false) {
  for (const spec of IMPORT_INDEXES) {
    if (!imports && "researchImport.instagramUrl" in spec.key) continue;
    const indexes = await db.collection(spec.collection).listIndexes().toArray().catch(() => []);
    const protectedByIndex = indexes.some((index) => index.unique && !index.sparse && JSON.stringify(index.key) === JSON.stringify(spec.key) &&
      (!index.partialFilterExpression || ("partialFilterExpression" in spec && JSON.stringify(index.partialFilterExpression) === JSON.stringify(spec.partialFilterExpression))) &&
      ("collation" in spec ? (index.collation?.locale === "en" && index.collation?.strength === 2 && !index.collation?.caseLevel) : (!index.collation || index.collation.locale === "simple")));
    if (!protectedByIndex) throw new CatalogSaveError(`Catalog saving requires the reviewed ${spec.name} index. No records were written. Production migration needs separate approval.`);
  }
}
