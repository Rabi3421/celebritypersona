import { NextResponse, type NextRequest } from "next/server";
import { del, list, put } from "@vercel/blob";
import { backupName, expiredBackups, PREFIX, redact } from "@/lib/backup/core";
import { encryptBackup, exportDatabase } from "@/lib/backup/run";

/**
 * The nightly database backup (vercel.json: 20:30 UTC = 02:00 IST).
 *
 * MongoDB Atlas's free tier keeps no backups, so this does. It reads the whole database with
 * the read-only `cp-backup` user (MONGODB_BACKUP_URI), encrypts it to the backup public key and
 * stores it in the private Vercel Blob store "celebritypersona-backups" (BLOB_STORE_ID, OIDC). Then, and only then, it
 * deletes backups older than 30 days, always keeping the newest 7.
 *
 * It fails closed: no CRON_SECRET → 503, wrong secret → 401, outside Production → 404. Any
 * failure is thrown, so it reaches PostHog error tracking (and #bugs-qa) with the connection
 * string and the cluster's host removed.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return NextResponse.json({ error: "Production only" }, { status: 404 });

  const uri = process.env.MONGODB_BACKUP_URI;
  if (!uri) throw new Error("Nightly backup failed: MONGODB_BACKUP_URI is not set.");
  // Connecting the store sets BLOB_STORE_ID; @vercel/blob then signs in with the function's
  // short-lived Vercel OIDC token (project setting, enabled). A read-write token also works.
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Nightly backup failed: no Blob store connected (BLOB_STORE_ID is not set).");

  const started = Date.now();
  try {
    const { createdAt, body, collections, documents } = await exportDatabase(uri);
    const encrypted = await encryptBackup(body);
    const pathname = PREFIX + backupName(createdAt);
    await put(pathname, Buffer.from(encrypted), { access: "private", contentType: "application/pgp-encrypted", addRandomSuffix: false });

    const blobs = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    const expired = expiredBackups(blobs, new Date());
    if (expired.length) await del(expired.map((b) => b.url));

    return NextResponse.json({
      ok: true,
      file: pathname,
      collections,
      documents,
      kb: Math.ceil(encrypted.length / 1024),
      seconds: Math.round((Date.now() - started) / 100) / 10,
      stored: blobs.length - expired.length,
      deleted: expired.length,
    });
  } catch (err) {
    throw new Error(`Nightly backup failed: ${redact(err, uri)}`);
  }
}
