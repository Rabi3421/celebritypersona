/** Read-only inspection. Load an environment file through Node, never print credentials.
 * No mutations, sessions, transactions or provisioning. Pure name helper only.
 */
import { MongoClient, BSON } from "mongodb";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { archiveIdentity } from "../lib/archive-name.ts";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Select an environment file with MONGODB_URI through Node --env-file");
const names = ["outfits", "celebrities", "occasions", "brands", "seoReviews", "catalogWriteState"];
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000, appName: "cp-read-only-outfit-review", readPreference: "primary" });
const report = { inspectedAt: new Date().toISOString(), atlasHostname: /\.mongodb\.net(?:[/:?]|$)/.test(uri), mode: "read-only inspection; no transaction or write attempted" };
const slug = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
function duplicates(rows, key, includeEmpty = false) {
  const buckets = new Map();
  for (const row of rows) {
    const value = key(row);
    if (!includeEmpty && (value === undefined || value === null || value === "")) continue;
    const list = buckets.get(value) ?? []; list.push(row.id ?? row.key ?? String(row._id)); buckets.set(value, list);
  }
  return [...buckets].filter(([, ids]) => ids.length > 1).map(([value, ids]) => ({ value, ids }));
}
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB ?? "celebritypersona");
  const hello = await db.admin().command({ hello: 1 });
  let version = "not permitted";
  try { version = (await db.admin().command({ buildInfo: 1 })).version; } catch { /* no extra permissions requested */ }
  report.topology = { version, replicaSet: Boolean(hello.setName), sharded: hello.msg === "isdbgrid", sessions: typeof hello.logicalSessionTimeoutMinutes === "number", maxWireVersion: hello.maxWireVersion, transactionCapableTopology: Boolean(hello.setName || hello.msg === "isdbgrid") && typeof hello.logicalSessionTimeoutMinutes === "number" && hello.maxWireVersion >= 7 };
  try {
    const status = await db.command({ connectionStatus: 1, showPrivileges: true });
    const privileges = status.authInfo?.authenticatedUserPrivileges ?? [];
    report.credentialCanWrite = privileges.some((p) => p.actions.some((a) => ["anyAction", "insert", "update", "remove", "createIndex"].includes(a)));
  } catch { report.credentialCanWrite = "not inspected"; }
  report.collections = {};
  for (const name of names) {
    const info = await db.listCollections({ name }, { nameOnly: false }).toArray();
    if (!info.length) { report.collections[name] = { exists: false }; continue; }
    const collection = db.collection(name);
    const indexes = await collection.listIndexes().toArray();
    const rows = await collection.find({}, { maxTimeMS: 15000 }).sort({ _id: 1 }).toArray();
    const entry = {
      exists: true, documents: rows.length,
      contentSha256: createHash("sha256").update(BSON.EJSON.stringify(rows)).digest("hex"),
      collectionType: info[0].type,
      options: { capped: Boolean(info[0].options?.capped), timeseries: Boolean(info[0].options?.timeseries), collation: info[0].options?.collation, validator: info[0].options?.validator },
      indexes: indexes.map(({ name, key, unique, partialFilterExpression, collation, sparse }) => ({ name, key, unique: name === "_id_" || Boolean(unique), ...(partialFilterExpression ? { partialFilterExpression } : {}), ...(collation ? { collation } : {}), ...(sparse ? { sparse } : {}) })),
      duplicates: {},
    };
    if (name === "outfits") {
      entry.duplicates = {
        id: duplicates(rows, (r) => r.id), storedSlug: duplicates(rows.filter((r) => typeof r.slug === "string"), (r) => r.slug, true),
        effectiveSlug: duplicates(rows, (r) => typeof r.slug === "string" && r.slug.trim() ? slug(r.slug) : slug(`${r.celebrity}-${r.event}-${r.date}`), true),
        importedPost: duplicates(rows.filter((r) => typeof r.researchImport?.instagramUrl === "string"), (r) => r.researchImport.instagramUrl, true),
      };
      entry.missingStoredSlug = rows.filter((r) => typeof r.slug !== "string").length;
      entry.invalidNumericIds = rows.filter((r) => !Number.isSafeInteger(r.id) || r.id < 1).length;
      entry.importedRecords = rows.filter((r) => r.researchImport).length;
      entry.invalidStoredSlugs = rows.filter((r) => r.slug !== undefined && (typeof r.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug))).length;
      entry.noncanonicalImportIdentities = rows.filter((r) => r.researchImport && (typeof r.researchImport.instagramUrl !== "string" || !/^https:\/\/www\.instagram\.com\/p\/[A-Za-z0-9_-]{3,100}\/$/.test(r.researchImport.instagramUrl))).length;
    } else if (name === "seoReviews") entry.duplicates = { key: duplicates(rows, (r) => r.key) };
    else if (name === "catalogWriteState") entry.ready = rows.some((r) => r._id === "catalog" && Number.isSafeInteger(r.version) && r.version >= 0);
    else {
      entry.duplicates = { id: duplicates(rows, (r) => r.id), normalizedName: duplicates(rows, (r) => typeof r.name === "string" ? archiveIdentity(r.name) : null, true) };
      entry.collatedNameDuplicates = await collection.aggregate([{ $group: { _id: "$name", ids: { $push: "$id" }, count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }], { collation: { locale: "en", strength: 2 }, maxTimeMS: 15000 }).toArray();
      entry.untrimmedNames = rows.filter((r) => typeof r.name !== "string" || r.name !== r.name.trim()).length;
      entry.invalidNames = rows.filter((r) => typeof r.name !== "string" || !archiveIdentity(r.name)).length;
      entry.invalidNumericIds = rows.filter((r) => !Number.isSafeInteger(r.id) || r.id < 1).length;
    }
    report.collections[name] = entry;
  }
  const out = process.argv[2];
  if (out) writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  // Driver messages may contain connection details; never print them.
  console.error(`Read-only database audit failed (${error?.name ?? "UnknownError"}); no write was attempted.`);
  process.exitCode = 1;
} finally { await client.close(); }
