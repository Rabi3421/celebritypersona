import "server-only";
import { gzipSync } from "node:zlib";
import { MongoClient, type Db } from "mongodb";
import { createMessage, encrypt, readKey } from "openpgp";
import { BSON } from "mongodb";
import { collectionHash, DATABASE, docText, FORMAT, REQUIRED } from "@/lib/backup/core";
import { BACKUP_PUBLIC_KEY } from "@/lib/backup/public-key";

const { EJSON } = BSON;

type Exported = {
  name: string;
  options: unknown;
  indexes: unknown[];
  count: number;
  sha256: string;
  docs: unknown[];
};

async function exportCollection(db: Db, name: string, options: unknown): Promise<Exported> {
  const coll = db.collection(name);
  for (let attempt = 1; ; attempt++) {
    const before = await coll.countDocuments({});
    const docs = await coll.find({}, { sort: { _id: 1 } }).toArray();
    const after = await coll.countDocuments({});
    if (before === docs.length && after === docs.length) {
      const indexes = (await coll.indexes()).filter((ix) => ix.name !== "_id_");
      return { name, options: options ?? {}, indexes, count: docs.length, sha256: collectionHash(docs.map(docText)), docs };
    }
    if (attempt === 2) throw new Error(`${name} kept changing while it was read (${before} → ${docs.length} → ${after}).`);
  }
}

/**
 * Read the whole database with the read-only backup user and return it gzip-compressed.
 * Throws when the database looks wrong (a required collection missing, no outfits), so
 * a bad night fails loudly instead of storing an empty copy.
 */
export async function exportDatabase(uri: string) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20_000, readPreference: "secondaryPreferred", appName: "cp-backup-cron" });
  try {
    await client.connect();
    const db = client.db(DATABASE);
    const infos = (await db.listCollections({}, { nameOnly: false }).toArray())
      .filter((c) => c.type === "collection" && !c.name.startsWith("system."))
      .sort((a, b) => a.name.localeCompare(b.name));
    const missing = REQUIRED.filter((n) => !infos.some((c) => c.name === n));
    if (missing.length) throw new Error(`The database has no ${missing.join(", ")}: refusing to store what looks like the wrong database.`);

    const collections: Exported[] = [];
    for (const info of infos) collections.push(await exportCollection(db, info.name, "options" in info ? info.options : {}));
    if (!collections.find((c) => c.name === "outfits")?.count) throw new Error("outfits is empty: refusing to store an empty backup.");

    const createdAt = new Date();
    const body = gzipSync(Buffer.from(EJSON.stringify({ format: FORMAT, database: DATABASE, createdAt: createdAt.toISOString(), collections }, { relaxed: false })), { level: 9 });
    return { createdAt, body, collections: collections.length, documents: collections.reduce((n, c) => n + c.count, 0) };
  } finally {
    await client.close().catch(() => {});
  }
}

/** Encrypt to the backup public key. Only the owner's offline private key can open the result. */
export async function encryptBackup(data: Uint8Array): Promise<Uint8Array> {
  const encryptionKeys = await readKey({ armoredKey: BACKUP_PUBLIC_KEY });
  const message = await createMessage({ binary: data });
  return encrypt({ message, encryptionKeys, format: "binary" });
}
