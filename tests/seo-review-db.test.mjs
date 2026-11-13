// The seoReviews repository against a real, disposable MongoDB.
//
// Skipped unless SEO_TEST_MONGODB_URI is set, and refused unless it names a
// database on this machine (lib/prod-guard.ts): this test writes and drops a
// database of its own, so it must never see production.
//   SEO_TEST_MONGODB_URI=mongodb://127.0.0.1:27027 npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
import { isLocalDatabase } from "../lib/prod-guard.ts";
import { reviewRepo } from "../lib/seo-review/repo.ts";
import { attachPrepared, saveReview } from "../lib/seo-review/store.ts";
import { duplicateKeys, ensureKeyIndex, keyIndexState } from "../scripts/seo-reviews-index.mjs";

const uri = process.env.SEO_TEST_MONGODB_URI;
const skip = !uri ? "SEO_TEST_MONGODB_URI not set" : !isLocalDatabase(uri) ? "refusing: not a local database" : false;

const session = { email: "editor@example.test" };
const now = new Date("2026-11-13T09:00:00Z");
const looks = { outfitExists: async () => true, slugOwner: async () => null };
const payload = (key, revision, keyword) => ({ key, revision, candidates: [{ keyword, role: "primary", evidence: [] }], serp: [] });

async function withDb(name, fn) {
  const client = await new MongoClient(uri).connect();
  const db = client.db(`cp_seo_review_test_${name}_${process.pid}`);
  try {
    await fn(db);
  } finally {
    await db.dropDatabase();
    await client.close();
  }
}

test("mongo: index check, duplicate detection and index creation on a disposable database", { skip }, () =>
  withDb("index", async (db) => {
    const collection = db.collection("seoReviews");
    assert.deepEqual(await keyIndexState(collection), { exists: false, documents: 0, keyIndex: null }, "a missing collection reads as empty, not an error");
    await collection.insertMany([{ key: "outfit:1", revision: 1 }, { key: "outfit:1", revision: 1 }, { key: "outfit:2", revision: 1 }]);
    assert.deepEqual(await duplicateKeys(collection), [{ key: "outfit:1", count: 2 }]);
    await assert.rejects(ensureKeyIndex(collection), /duplicate keys/, "the index is not attempted over duplicates");
    await collection.deleteOne({ key: "outfit:1" });
    assert.equal((await ensureKeyIndex(collection)).created, true);
    assert.equal((await ensureKeyIndex(collection)).created, false, "running it again is a no-op");
    const state = await keyIndexState(collection);
    assert.equal(state.keyIndex.unique, true);
    await assert.rejects(collection.insertOne({ key: "outfit:2", revision: 9 }), /E11000/, "the index refuses a second document per key");
    assert.equal(await db.collection("outfits").countDocuments(), 0, "outfits are never written");
  }));

test("mongo: insert, revision-checked replace, conflict, projection without _id", { skip }, () =>
  withDb("repo", async (db) => {
    const collection = db.collection("seoReviews");
    await ensureKeyIndex(collection);
    const repo = reviewRepo(collection);
    const first = await saveReview({ session, payload: payload("outfit:1", 0, "a black dress"), repo, now, looks });
    assert.equal(first.ok, true);
    const stored = await repo.get("outfit:1");
    assert.equal(stored._id, undefined, "the Mongo id never leaves the repository");
    assert.equal(stored.revision, 1);
    assert.equal(await repo.put({ ...stored, revision: 1 }, 0), "conflict", "a second first-save is refused");
    const second = await saveReview({ session, payload: payload("outfit:1", 1, "a red dress"), repo, now, looks });
    assert.equal(second.ok, true);
    assert.equal((await repo.get("outfit:1")).candidates[0].keyword, "a red dress");
    const stale = await saveReview({ session, payload: payload("outfit:1", 1, "a blue dress"), repo, now, looks });
    assert.equal(stale.conflict, true);
    assert.equal(await collection.countDocuments(), 1, "one document per look");
    assert.equal(await db.collection("outfits").countDocuments(), 0, "outfits are never written");
  }));

test("mongo: concurrent first saves and concurrent edits — exactly one wins, nothing is lost silently", { skip }, () =>
  withDb("race", async (db) => {
    const collection = db.collection("seoReviews");
    await ensureKeyIndex(collection);
    const repo = reviewRepo(collection);
    const firsts = await Promise.all(
      Array.from({ length: 20 }, (_, i) => saveReview({ session, payload: payload("prepared:black-dress", 0, `draft ${i}`), repo, now, looks })),
    );
    assert.equal(firsts.filter((r) => r.ok).length, 1, "one first save wins");
    assert.equal(firsts.filter((r) => r.conflict).length, 19, "every other is told it conflicted");
    assert.equal(await collection.countDocuments({ key: "prepared:black-dress" }), 1);
    const winner = firsts.find((r) => r.ok).review.candidates[0].keyword;
    assert.equal((await repo.get("prepared:black-dress")).candidates[0].keyword, winner, "what is stored is what the winner was told");

    const edits = await Promise.all(
      Array.from({ length: 20 }, (_, i) => saveReview({ session, payload: payload("prepared:black-dress", 1, `edit ${i}`), repo, now, looks })),
    );
    assert.equal(edits.filter((r) => r.ok).length, 1, "one edit from revision 1 wins");
    const stored = await repo.get("prepared:black-dress");
    assert.equal(stored.revision, 2);
    assert.equal(stored.candidates[0].keyword, edits.find((r) => r.ok).review.candidates[0].keyword);
  }));

test("mongo: attaching prepared research moves it to the look and deletes the prepared copy", { skip }, () =>
  withDb("attach", async (db) => {
    const collection = db.collection("seoReviews");
    await ensureKeyIndex(collection);
    const repo = reviewRepo(collection);
    await saveReview({ session, payload: payload("prepared:black-dress", 0, "a black dress"), repo, now, looks });
    const attach = () => attachPrepared({ session, outfitId: 5, slug: "black-dress", revision: 1, repo, now, savedSlugOf: async () => "black-dress" });
    const [a, b] = await Promise.all([attach(), attach()]);
    assert.equal([a, b].filter((r) => r.ok).length, 1, "two simultaneous attaches: one wins");
    assert.equal(await collection.countDocuments({ key: "prepared:black-dress" }), 0);
    const attached = await repo.get("outfit:5");
    assert.equal(attached.candidates[0].keyword, "a black dress");
    assert.equal(attached.attachedFrom.key, "prepared:black-dress");
    assert.equal(await collection.countDocuments(), 1);
  }));
