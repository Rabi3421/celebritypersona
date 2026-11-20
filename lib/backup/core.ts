/**
 * The nightly database backup: the pure parts, shared by the cron route and the tests.
 *
 * A backup is one JSON document in canonical Extended JSON, gzip-compressed, then encrypted:
 *   { format, database, createdAt, collections: [{ name, options, indexes, count, sha256, docs }] }
 * Canonical EJSON keeps every BSON type exactly (ObjectId, Date, Long, Decimal128, Binary), and
 * `sha256` covers a collection's documents in _id order, so a restore can prove it put back
 * exactly what was exported. The format is the one `restore.mjs` in celebritypersona-backup reads.
 */
import { createHash } from "node:crypto";
import { BSON } from "mongodb";

export const FORMAT = 1;
export const DATABASE = "celebritypersona";
/** Where backups live in the Blob store. */
export const PREFIX = "backups/";
/** Backups older than this are deleted after a successful new one... */
export const KEEP_DAYS = 30;
/** ...but never so many that fewer than this many remain. */
export const KEEP_AT_LEAST = 7;
/** A database without these is the wrong database, or has lost its catalogue. */
export const REQUIRED = ["outfits", "celebrities", "occasions", "brands"] as const;

const { EJSON } = BSON;

/** Canonical EJSON for one document: the unit both the export and the restore check hash. */
export const docText = (doc: unknown) => EJSON.stringify(doc, { relaxed: false });

export function collectionHash(texts: string[]) {
  const h = createHash("sha256");
  for (const t of texts) h.update(t).update("\n");
  return h.digest("hex");
}

/** backup-2026-11-20T20-30-01Z.json.gz.gpg */
export const backupName = (at: Date) => `backup-${at.toISOString().replace(/[:.]/g, "-").slice(0, 19)}Z.json.gz.gpg`;

/**
 * Which stored backups to delete: those older than KEEP_DAYS, except that the newest
 * KEEP_AT_LEAST always stay. Only called after a new backup has been stored, so a run of
 * failed nights never eats into the last good copies.
 */
export function expiredBackups<T extends { pathname: string; uploadedAt: Date }>(blobs: T[], now: Date): T[] {
  const ours = blobs.filter((b) => b.pathname.startsWith(PREFIX)).sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  const cutoff = now.getTime() - KEEP_DAYS * 86_400_000;
  return ours.slice(KEEP_AT_LEAST).filter((b) => b.uploadedAt.getTime() < cutoff);
}

/** An error message safe to log and to send to error tracking: no connection string, no host. */
export function redact(err: unknown, uri?: string) {
  let text = String((err as Error)?.message ?? err);
  if (uri) text = text.split(uri).join("<connection string>");
  return text
    .replace(/mongodb(\+srv)?:\/\/[^\s"']+/g, "<connection string>")
    .replace(/[\w.-]+\.mongodb\.net/g, "<cluster>");
}
