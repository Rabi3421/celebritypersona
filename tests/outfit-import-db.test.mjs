import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
import { isLocalDatabase } from "../lib/prod-guard.ts";
import { IMPORT_INDEXES, persistImportedDraft, requireImportIndexes } from "../lib/db/imported-outfits.ts";
import { IMPORT_FIELDS, proposedFields, mergeResearch, validateDraft } from "../lib/outfit-research.ts";
import { researchFixture, emptyDraft } from "./outfit-research-fixtures.mjs";
const uri = process.env.OUTFIT_TEST_MONGODB_URI;
const skip = !uri || !isLocalDatabase(uri) ? "Needs an explicitly selected local disposable replica set" : false;
test("mongo: imported drafts are atomic, idempotent and leave existing outfits unchanged", { skip }, async () => {
  const client = await new MongoClient(uri).connect();
  const db = client.db(`cp_outfit_import_test_${process.pid}`);
  try {
    const research = researchFixture();
    const draft = mergeResearch(emptyDraft(), proposedFields(research, false), IMPORT_FIELDS);
    const parsed = validateDraft(draft); assert.equal(parsed.success, true);
    const input = parsed.data;
    const provenance = { instagramUrl: research.inputs.instagramUrl, productUrl: research.inputs.productUrl, research, approvedFields: [...IMPORT_FIELDS], importedAt: new Date().toISOString() };
    const approvedRelated = JSON.stringify({ celebrities: ["Test Person"], occasions: ["Party"], brands: ["Example Label"] });
    const args = { client, db, input, provenance, approvedRelated, actor: "synthetic@example.test" };
    await assert.rejects(requireImportIndexes(db), /requires/);
    assert.equal(await db.collection("outfits").countDocuments(), 0);
    for (const { collection, ...spec } of IMPORT_INDEXES) {
      const { key, ...options } = spec;
      await db.collection(collection).createIndex(key, { ...options, name: options.name === "outfit_id_unique" ? "existing_id_1" : options.name, unique: true });
    }
    await requireImportIndexes(db); // An equivalent pre-existing index needs no rename.
    await db.collection("catalogWriteState").insertOne({ _id: "catalog", version: 0 });
    const baseline = { id: 50, celebrity: "Existing Person", event: "Existing Event", date: "2026-01-01", slug: "existing-look", status: "published", worn: 99, swap: 0, occasion: "Party", items: [{ name: "Dress", worn: 99 }] };
    await db.collection("outfits").insertOne(baseline);
    await assert.rejects(persistImportedDraft({ ...args, approvedRelated: "" }), /Approve/);
    assert.equal(await db.collection("outfits").countDocuments(), 1, "failure leaves no partial outfit");
    assert.equal(await db.collection("celebrities").countDocuments(), 0);
    const results = await Promise.allSettled([persistImportedDraft(args), persistImportedDraft(args)]);
    assert.ok(results.some((r) => r.status === "fulfilled"));
    const id = await persistImportedDraft(args);
    assert.equal(await db.collection("outfits").countDocuments(), 2);
    assert.deepEqual(await db.collection("outfits").findOne({ id: 50 }), baseline);
    const saved = await db.collection("outfits").findOne({ id });
    assert.equal(saved.status, "draft"); assert.equal(saved.publishedAt, undefined); assert.equal(saved.slugLockedAt, undefined);
    assert.equal(saved.pricesCheckedAt, undefined);
    assert.equal(await db.collection("celebrities").countDocuments(), 1);
    assert.equal(await db.collection("occasions").countDocuments(), 1);
    assert.equal(await db.collection("brands").countDocuments(), 1);
    await assert.rejects(persistImportedDraft({ ...args, input: { ...input, status: "published" } }), /Draft/);
    const other = structuredClone(provenance); other.instagramUrl = "https://www.instagram.com/p/OTHER_POST/"; other.research.inputs.instagramUrl = other.instagramUrl;
    await assert.rejects(persistImportedDraft({ ...args, provenance: other }), /slug/);
    assert.equal(await db.collection("outfits").countDocuments(), 2);
    await db.command({ collMod: "brands", validator: { name: { $ne: "Rollback Label" } } });
    const rollback = structuredClone(provenance);
    rollback.instagramUrl = "https://www.instagram.com/p/ROLLBACK_POST/";
    rollback.research.inputs.instagramUrl = rollback.instagramUrl;
    await assert.rejects(persistImportedDraft({ ...args, provenance: rollback, approvedRelated: JSON.stringify({ celebrities: ["Rollback Person"], occasions: [], brands: ["Rollback Label"] }), input: { ...input, slug: "rollback-look", celebrity: "Rollback Person", items: [{ name: "Rollback piece", wornBrand: "Rollback Label" }] } }), /validation/);
    assert.equal(await db.collection("outfits").countDocuments(), 2, "failure after related writes rolls the whole transaction back");
    assert.equal(await db.collection("celebrities").countDocuments(), 1, "new celebrity rolled back too");
    // Fail on the SECOND brand so celebrity, occasion and the first brand have
    // already been inserted within the transaction before the error occurs.
    await db.command({ collMod: "brands", validator: { name: { $ne: "Fail Brand" } } });
    const allRelatedRollback = structuredClone(rollback);
    allRelatedRollback.instagramUrl = "https://www.instagram.com/p/ALL_RELATED_ROLLBACK/";
    allRelatedRollback.research.inputs.instagramUrl = allRelatedRollback.instagramUrl;
    await assert.rejects(persistImportedDraft({ ...args, provenance: allRelatedRollback,
      approvedRelated: JSON.stringify({ celebrities: ["Rollback Person"], occasions: ["Rollback Occasion"], brands: ["Created Brand", "Fail Brand"] }),
      input: { ...input, slug: "all-related-rollback", celebrity: "Rollback Person", occasion: "Rollback Occasion", occasions: ["Rollback Occasion"], items: [{ name: "Rollback piece", wornBrand: "Created Brand", swapBrand: "Fail Brand" }] },
    }), /validation/);
    for (const name of ["celebrities", "occasions", "brands"]) assert.equal(await db.collection(name).countDocuments(), 1, `${name}: no orphan after all related types were inserted`);
    assert.equal(await db.collection("outfits").countDocuments(), 2);
    // A retry must never rewrite a record that an editor has since published.
    await db.collection("outfits").updateOne({ id }, { $set: { status: "published" } });
    assert.equal(await persistImportedDraft(args), id);
    assert.equal((await db.collection("outfits").findOne({ id })).status, "published");
  } finally { await db.dropDatabase(); await client.close(); }
});
