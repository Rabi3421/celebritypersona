import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { MongoClient, BSON } from "mongodb";
import { isLocalDatabase } from "../lib/prod-guard.ts";
import { IMPORT_INDEXES } from "../lib/db/catalog-indexes.ts";
import { persistOutfit, outfitVersion } from "../lib/db/catalog-outfits.ts";
import { persistHubCreate, persistHubEdit, persistHubRename } from "../lib/db/catalog-hubs.ts";
import { resolveArchiveName } from "../lib/db/catalog-identity.ts";
import { catalogTransaction } from "../lib/db/catalog-transaction.ts";
import { catalogMaintenance } from "../lib/db/catalog-maintenance.ts";
import { IMPORT_FIELDS, mergeResearch, proposedFields, validateDraft } from "../lib/outfit-research.ts";
import { researchFixture, emptyDraft } from "./outfit-research-fixtures.mjs";

const uri = process.env.OUTFIT_TEST_MONGODB_URI;
const skip = !uri || !isLocalDatabase(uri) ? "Requires disposable local replica set" : false;
const actor = "synthetic@example.test";
const tracked = ["outfits", "celebrities", "occasions", "brands", "redirects", "catalogWriteState", "seoReviews", "unrelated"];

test("catalog: migration audit sees normalized ambiguities and leaves disposable content unchanged", { skip }, () => fixture("audit", async ({ db, create, snapshot }) => {
  await create(input());
  await db.collection("brands").insertMany([{ id: 2, name: "Legacy  Label" }, { id: 3, name: "Legacy Label" }]);
  const before = await snapshot();
  const report = JSON.parse(execFileSync(process.execPath, ["scripts/audit-outfit-database.mjs"], {
    encoding: "utf8", env: { ...process.env, MONGODB_URI: uri, MONGODB_DB: db.databaseName }, stdio: ["ignore", "pipe", "pipe"],
  }));
  assert.equal(report.collections.catalogWriteState.ready, true);
  assert.deepEqual(report.collections.brands.duplicates.normalizedName, [{ value: "legacy label", ids: [2, 3] }]);
  assert.deepEqual(await snapshot(), before);
}));

test("catalog: exact six indexes cover null, missing, empty, case and numeric collisions", { skip }, () => fixture("indexvalues", async ({ db }) => {
  const looks = db.collection("outfits");
  await looks.insertMany([{ id: 1 }, { id: 2, slug: null, researchImport: { instagramUrl: null } }, { id: 3 }]);
  await looks.insertOne({ id: 4, slug: "", researchImport: { instagramUrl: "" } });
  await assert.rejects(looks.insertOne({ id: 5, slug: "" }), { code: 11000 });
  await assert.rejects(looks.insertOne({ id: 6, researchImport: { instagramUrl: "" } }), { code: 11000 });
  // Simple slug collation is case sensitive; form validation forces lowercase.
  await looks.insertMany([{ id: 7, slug: "Case" }, { id: 8, slug: "case" }]);
  for (const name of ["celebrities", "occasions", "brands"]) {
    const records = db.collection(name);
    await records.insertOne({ id: 1 });
    await assert.rejects(records.insertOne({ id: 2, name: null }), { code: 11000 });
    await records.insertOne({ id: 3, name: "" });
    await assert.rejects(records.insertOne({ id: 4, name: "" }), { code: 11000 });
    await records.insertOne({ id: 5, name: "Mixed CASE" });
    await assert.rejects(records.insertOne({ id: 6, name: "mixed case" }), { code: 11000 });
    await assert.rejects(records.insertOne({ id: 5, name: "Different Name" }), { code: 11000 });
    await records.insertOne({ id: 7, name: " Mixed CASE " }); // Whitespace is application-normalized.
  }
}));

test("catalog: maintenance checks its complete source and rolls back later failures", { skip }, () => fixture("maintenance", async ({ client, db, create, snapshot }) => {
  const saved = (await create(input())).next;
  const before = await snapshot();
  const expected = [{ collection: "outfits", documents: [saved] }];
  await assert.rejects(catalogMaintenance(client, db, expected, async (session) => {
    await db.collection("outfits").updateOne({ id: saved.id }, { $set: { event: "Changed" } }, { session });
    await db.collection("brands").insertOne({ id: 1, name: "Different identity" }, { session });
  }), /uniqueness/);
  assert.deepEqual(await snapshot(), before);
  await db.collection("outfits").updateOne({ id: saved.id }, { $set: { event: "Other editor" } });
  const changed = await snapshot();
  await assert.rejects(catalogMaintenance(client, db, expected, async () => assert.fail("stale plan ran")), /stale/);
  assert.deepEqual(await snapshot(), changed);
}));

test("catalog: malformed legacy numeric brand IDs fail closed without orphan records", { skip }, () => fixture("badids", async ({ db, create, snapshot }) => {
  await db.collection("brands").insertOne({ id: null, name: "Legacy broken ID" });
  const before = await snapshot();
  await assert.rejects(create(input()), /invalid legacy numeric ID/);
  assert.deepEqual(await snapshot(), before);
}));
function input(suffix = "one") {
  const parsed = validateDraft(mergeResearch(emptyDraft(), proposedFields(researchFixture(), false), IMPORT_FIELDS));
  assert.ok(parsed.success);
  const value = parsed.data;
  return { ...value, slug: `${value.slug}-${suffix}`, leadPieceId: value.items[0].id,
    images: [{ url: "https://photo.example/synthetic.png", path: "dev/synthetic/photo.png", credit: "@synthetic", alt: "Test Person wearing a navy silk saree" }],
    notes: [`Test Person navy silk saree. ${Array.from({ length: 160 }, (_, i) => `detail${i}`).join(" ")}`],
  };
}
async function fixture(name, fn) {
  const client = await new MongoClient(uri).connect();
  const db = client.db(`cp_catalog_test_${name}_${process.pid}`);
  try {
    for (const { collection, key, ...spec } of IMPORT_INDEXES) await db.collection(collection).createIndex(key, { ...spec, unique: true });
    await db.collection("catalogWriteState").insertOne({ _id: "catalog", version: 0 });
    await db.collection("unrelated").insertOne({ _id: "sentinel", value: "must remain unchanged" });
    const context = { client, db, actor };
    const create = (value, extra = {}) => persistOutfit({ ...context, mode: "create", requestKey: randomUUID(), input: value, ...extra });
    const edit = (saved, value, extra = {}) => persistOutfit({ ...context, mode: "edit", id: saved.id, expectedVersion: outfitVersion(saved), input: value, ...extra });
    const snapshot = async () => {
      const content = {};
      for (const name of tracked) content[name] = BSON.EJSON.stringify(await db.collection(name).find({}).sort({ _id: 1 }).toArray());
      return content;
    };
    await fn({ ...context, create, edit, snapshot });
  } finally { await db.dropDatabase(); await client.close(); }
}

test("catalog: ordinary create rolls back all related records and safely retries the same request", { skip }, () => fixture("create", async ({ db, create, snapshot }) => {
  await db.command({ collMod: "brands", validator: { name: { $ne: "Fail Brand" } } });
  const value = input(); value.items[0].swapBrand = "Fail Brand";
  const before = await snapshot(); const effects = [];
  const options = { requestKey: randomUUID(), afterCommit: (result) => effects.push(result.next.id) };
  await assert.rejects(create(value, options), /validation/);
  assert.deepEqual(await snapshot(), before, "outfit, all hubs, redirects and coordination roll back");
  assert.deepEqual(effects, [], "no public refresh or image cleanup callback after failure");
  await db.command({ collMod: "brands", validator: {} });
  const saved = await create(value, options);
  const replay = await create({ ...value, event: "Changed after an uncertain response" }, options);
  assert.equal(replay.replayed, true); assert.equal(replay.next.id, saved.next.id);
  assert.equal(replay.next.event, value.event, "retry never overwrites the committed outfit");
  assert.equal(await db.collection("outfits").countDocuments(), 1);
  assert.equal(await db.collection("brands").countDocuments(), 2);
  assert.deepEqual(effects, [saved.next.id]);
}));
test("catalog: concurrent creates serialize numeric IDs and reuse only matching shared hubs", { skip }, () => fixture("creates", async ({ db, create }) => {
  const outcomes = await Promise.all(Array.from({ length: 8 }, (_, i) => {
    const value = input(String(i)); value.items[0].wornBrand = `Distinct Brand ${i}`;
    if (i % 2) { value.celebrity = "  test   PERSON "; value.occasion = " party "; value.occasions = [" PARTY "]; }
    return create(value);
  }));
  assert.equal(new Set(outcomes.map((r) => r.next.id)).size, 8);
  const brands = await db.collection("brands").find({}).toArray();
  assert.deepEqual(brands.map((b) => b.id).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(await db.collection("celebrities").countDocuments(), 1);
  assert.equal(await db.collection("occasions").countDocuments(), 1);
  assert.equal(new Set(outcomes.map((r) => r.next.celebrity)).size, 1);
}));
test("catalog: concurrent repeated create requests produce one outfit and one effect", { skip }, () => fixture("replay", async ({ create, db }) => {
  const options = { requestKey: randomUUID(), afterCommit: () => { effects++; } }; let effects = 0;
  const results = await Promise.all(Array.from({ length: 6 }, () => create(input(), options)));
  assert.equal(new Set(results.map((r) => r.next.id)).size, 1);
  assert.equal(results.filter((r) => !r.replayed).length, 1);
  assert.equal(await db.collection("outfits").countDocuments(), 1); assert.equal(effects, 1);
}));
test("catalog: failed edit/publication restores the complete previous outfit and related state", { skip }, () => fixture("edit", async ({ db, create, edit, snapshot }) => {
  const original = input(); const { next } = await create(original);
  const before = await snapshot(); const effects = [];
  await db.command({ collMod: "brands", validator: { name: { $ne: "Fail Brand" } } });
  const changed = { ...original, celebrity: "New Person", occasion: "New Occasion", occasions: ["New Occasion"], status: "published", items: [{ ...original.items[0], wornBrand: "New Brand", swapBrand: "Fail Brand" }] };
  await assert.rejects(edit(next, changed, { afterCommit: () => effects.push("public-refresh") }), /validation/);
  assert.deepEqual(await snapshot(), before); assert.deepEqual(effects, []);
  const stored = await db.collection("outfits").findOne({ id: next.id });
  assert.equal(stored.status, "draft"); assert.equal(stored.publishedAt, undefined); assert.equal(stored.slugLockedAt, undefined);
  await db.command({ collMod: "brands", validator: {} });
  const result = await edit(next, { ...original, event: "Safe edit", status: "published" });
  assert.equal(result.next.status, "published"); assert.match(result.next.publishedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(result.next.slugLockedAt); assert.deepEqual(result.next.images, original.images);
}));
test("catalog: concurrent edits report a stale version instead of overwriting the winner", { skip }, () => fixture("stale", async ({ create, edit, db }) => {
  const original = input(); const { next } = await create(original);
  const edits = await Promise.allSettled([edit(next, { ...original, event: "Editor one" }), edit(next, { ...original, event: "Editor two" })]);
  assert.equal(edits.filter((r) => r.status === "fulfilled").length, 1);
  assert.match(edits.find((r) => r.status === "rejected").reason.message, /Another editor/);
  const stored = await db.collection("outfits").findOne({ id: next.id });
  assert.ok(["Editor one", "Editor two"].includes(stored.event));
  await assert.rejects(edit(next, original), /Another editor/);
}));
test("catalog: only one concurrent draft can publish with a shared primary keyword", { skip }, () => fixture("publish", async ({ create, edit, db }) => {
  const one = input("first"), two = input("second");
  const a = (await create(one)).next, b = (await create(two)).next;
  const results = await Promise.allSettled([edit(a, { ...one, status: "published" }), edit(b, { ...two, status: "published" })]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.match(results.find((r) => r.status === "rejected").reason.message, /No other published/);
  assert.equal(await db.collection("outfits").countDocuments({ status: "published" }), 1);
  const draft = await db.collection("outfits").findOne({ status: "draft" });
  assert.equal(draft.publishedAt, undefined); assert.equal(draft.slugLockedAt, undefined);
}));
test("catalog: duplicate slugs never leak hubs and slug redirects roll back with failed edits", { skip }, () => fixture("slug", async ({ create, edit, db, snapshot }) => {
  const original = input(); const a = (await create({ ...original, status: "published" })).next;
  const before = await snapshot();
  await assert.rejects(create({ ...original, celebrity: "Unwanted Person" }), /slug/);
  assert.deepEqual(await snapshot(), before);
  await assert.rejects(edit(a, { ...original, slug: `${original.slug}-moved` }), /locked/);
  await db.command({ collMod: "outfits", validator: { event: { $ne: "FAIL_AFTER_REDIRECT" } } });
  await assert.rejects(edit(a, { ...original, status: "published", event: "FAIL_AFTER_REDIRECT", slug: `${original.slug}-moved` }, { slugUnlocked: true }), /validation/);
  assert.deepEqual(await snapshot(), before, "redirect writes rolled back too");
  await db.command({ collMod: "outfits", validator: {} });
  const moved = await edit(a, { ...original, status: "published", slug: `${original.slug}-moved` }, { slugUnlocked: true });
  const redirect = await db.collection("redirects").findOne({ kind: "outfit", from: original.slug });
  assert.equal(redirect.to, moved.next.slug);
}));
test("catalog: unrelated unique constraints are errors, not silent reuse", { skip }, () => fixture("other_index", async ({ create, db, snapshot }) => {
  await db.collection("outfits").createIndex({ event: 1 }, { unique: true });
  await create(input()); const before = await snapshot();
  await assert.rejects(create({ ...input("other"), celebrity: "Not Created" }), /uniqueness/);
  assert.deepEqual(await snapshot(), before);
}));
test("catalog: names preserve canonical records, reject ambiguity and distinguish different identities", { skip }, () => fixture("names", async ({ client, db, create }) => {
  await db.collection("celebrities").insertOne({ id: 10, name: "TÉST Person" });
  const value = { ...input(), celebrity: " te\u0301st   PERSON " };
  const saved = await create(value);
  assert.equal(saved.next.celebrity, "TÉST Person");
  await create({ ...input("distinct"), celebrity: "Test Person" });
  assert.equal(await db.collection("celebrities").countDocuments(), 2, "accents are not stripped");
  await db.collection("brands").insertMany([{ id: 2, name: "Legacy  Name" }, { id: 3, name: "Legacy Name" }]);
  await assert.rejects(catalogTransaction(client, db, (session) => resolveArchiveName(db, "brands", "legacy name", session)), /more than one/);
}));
test("catalog: standalone hub conflicts and rename failures leave no partial redirects or renamed looks", { skip }, () => fixture("hub", async ({ client, db, create, snapshot }) => {
  const a = await persistHubCreate({ client, db, collection: "celebrities", input: { name: "Person A" } });
  await persistHubCreate({ client, db, collection: "celebrities", input: { name: "Person B" } });
  await assert.rejects(persistHubCreate({ client, db, collection: "celebrities", input: { name: " person a " } }), /already belongs/);
  await create({ ...input(), celebrity: "Person A" });
  const before = await snapshot();
  await assert.rejects(persistHubEdit({ client, db, collection: "celebrities", id: a, input: { name: "Person B" } }), /already uses/);
  assert.deepEqual(await snapshot(), before);
  await db.command({ collMod: "outfits", validator: { celebrity: { $ne: "Person C" } } });
  await assert.rejects(persistHubEdit({ client, db, collection: "celebrities", id: a, input: { name: "Person C" } }), /validation/);
  assert.deepEqual(await snapshot(), before);
  await db.command({ collMod: "outfits", validator: {} });
  const result = await persistHubRename({ client, db, collection: "celebrities", from: "Person A", to: "Person B" });
  assert.equal(result.merged, true); assert.equal(result.looks, 1);
  assert.equal(await db.collection("celebrities").countDocuments(), 1);
  assert.equal((await db.collection("outfits").findOne({})).celebrity, "Person B");
}));
test("catalog: missing coordination fails closed and post-commit failures are reported as saved", { skip }, () => fixture("coordination", async ({ db, create }) => {
  await db.collection("catalogWriteState").deleteOne({ _id: "catalog" });
  await assert.rejects(create(input()), /not provisioned/);
  assert.equal(await db.collection("outfits").countDocuments(), 0);
  await db.collection("catalogWriteState").insertOne({ _id: "catalog", version: 0 });
  const result = await create(input(), { afterCommit: () => { throw new Error("Synthetic cache failure"); } });
  assert.equal(result.refreshWarning, true); assert.equal(await db.collection("outfits").countDocuments(), 1);
}));
test("catalog: legacy fields, image order, evidence and unknown metadata survive an edit", { skip }, () => fixture("legacy", async ({ db, edit }) => {
  const value = input();
  const legacy = { ...value, id: 5, worn: 12000, swap: 0, image: value.images[0], images: undefined, status: undefined,
    unknownMetadata: { preserved: true }, lastMaintenance: new Date("2026-11-01T00:00:00Z"), researchImport: { retainedEvidence: "synthetic legacy evidence" } };
  await db.collection("outfits").insertOne(legacy);
  const stored = await db.collection("outfits").findOne({ id: 5 });
  const result = await edit(stored, { ...value, status: "published", event: "Corrected legacy event" });
  assert.equal(result.next.image, undefined); assert.deepEqual(result.next.images, value.images);
  assert.deepEqual(result.next.unknownMetadata, { preserved: true });
  assert.deepEqual(result.next.researchImport, legacy.researchImport);
  assert.equal(result.next.publishedAt, undefined, "legacy live status is not restamped as first publication");
}));
