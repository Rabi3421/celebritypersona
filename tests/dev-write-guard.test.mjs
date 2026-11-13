// `next dev` against a remote database reads but never writes (lib/dev-write-guard.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEV_WRITE_OPT_IN, DevWriteRefused, devWriteBlock, readOnlyDb } from "../lib/dev-write-guard.ts";

const ATLAS = "mongodb+srv://user:pass@cluster0.example.mongodb.net/";

test("dev write guard: only `next dev` against a non-local database is blocked", () => {
  assert.equal(devWriteBlock({ NODE_ENV: "production", MONGODB_URI: ATLAS }), null, "production is never touched");
  assert.equal(devWriteBlock({ NODE_ENV: "production", VERCEL_ENV: "preview", MONGODB_URI: ATLAS }), null, "previews are not changed by this");
  assert.equal(devWriteBlock({ NODE_ENV: "test", MONGODB_URI: ATLAS }), null);
  assert.match(devWriteBlock({ NODE_ENV: "development", MONGODB_URI: ATLAS }), /writes are switched off/);
  assert.match(devWriteBlock({ NODE_ENV: "development", MONGODB_URI: "" }), /not on this machine/, "unknown counts as production");
  assert.match(devWriteBlock({ NODE_ENV: "development", MONGODB_URI: "mongodb://db.example.com:27017" }), /Refused/);
  assert.equal(devWriteBlock({ NODE_ENV: "development", MONGODB_URI: "mongodb://127.0.0.1:27027" }), null, "a local database writes");
  assert.match(devWriteBlock({ NODE_ENV: "development", MONGODB_URI: ATLAS, CP_DEV_PRODUCTION_WRITES: "yes" }), /Refused/, "a casual opt-in is not enough");
  assert.equal(devWriteBlock({ NODE_ENV: "development", MONGODB_URI: ATLAS, CP_DEV_PRODUCTION_WRITES: DEV_WRITE_OPT_IN }), null);
});

test("dev write guard: reads pass through, every write throws before reaching the driver", () => {
  const sent = [];
  const collection = new Proxy(
    {},
    { get: (_, prop) => (typeof prop === "string" ? (...args) => (sent.push(prop), { prop, args }) : undefined) },
  );
  const fakeDb = { databaseName: "prod", collection: () => collection, dropDatabase: () => sent.push("dropDatabase"), stats: () => "stats" };
  const db = readOnlyDb(fakeDb, "Refused: test");
  const outfits = db.collection("outfits");
  assert.equal(outfits.findOne({ id: 1 }).prop, "findOne");
  assert.equal(outfits.countDocuments().prop, "countDocuments");
  assert.equal(outfits.aggregate([{ $match: {} }]).prop, "aggregate");
  assert.equal(db.stats(), "stats");
  assert.equal(db.databaseName, "prod");
  const writes = ["insertOne", "insertMany", "updateOne", "updateMany", "replaceOne", "deleteOne", "deleteMany", "findOneAndUpdate", "findOneAndReplace", "findOneAndDelete", "bulkWrite", "createIndex", "dropIndex", "drop"];
  for (const write of writes) {
    assert.throws(() => outfits[write]({}), (e) => e instanceof DevWriteRefused && e.message.includes(`outfits.${write}`), write);
  }
  assert.throws(() => outfits.aggregate([{ $match: {} }, { $out: "copy" }]), DevWriteRefused);
  assert.throws(() => outfits.aggregate([{ $merge: { into: "x" } }]), DevWriteRefused);
  assert.throws(() => db.dropDatabase(), DevWriteRefused);
  assert.deepEqual(sent, ["findOne", "countDocuments", "aggregate"], "no write reached the driver");
});
