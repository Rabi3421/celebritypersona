import test from "node:test";
import assert from "node:assert/strict";
import { readKey, readMessage } from "openpgp";
import { backupName, expiredBackups, KEEP_AT_LEAST, PREFIX, redact } from "@/lib/backup/core";
import { encryptBackup } from "@/lib/backup/run";
import { BACKUP_PUBLIC_KEY } from "@/lib/backup/public-key";

const DAY = 86_400_000;
const NOW = new Date("2026-12-31T20:30:00Z");
const blob = (daysAgo, pathname = `${PREFIX}b${daysAgo}`) => ({ pathname, uploadedAt: new Date(NOW.getTime() - daysAgo * DAY) });

test("backup names sort by time and carry the gpg extension", () => {
  assert.equal(backupName(new Date("2026-11-20T20:30:01.123Z")), "backup-2026-11-20T20-30-01Z.json.gz.gpg");
});

test("retention: nightly backups for 40 days keep the last 30 days", () => {
  const blobs = Array.from({ length: 40 }, (_, i) => blob(i));
  const gone = expiredBackups(blobs, NOW).map((b) => b.pathname).sort();
  assert.deepEqual(gone, Array.from({ length: 9 }, (_, i) => `${PREFIX}b${31 + i}`).sort());
});

test("retention: after a long gap, the newest 7 stay even when all are old", () => {
  const blobs = Array.from({ length: 10 }, (_, i) => blob(100 + i));
  const gone = expiredBackups(blobs, NOW);
  assert.equal(gone.length, 10 - KEEP_AT_LEAST);
  assert.ok(gone.every((b) => b.uploadedAt.getTime() <= blob(107).uploadedAt.getTime()), "only the oldest go");
});

test("retention never touches files outside the backups/ folder", () => {
  const blobs = [...Array.from({ length: 10 }, (_, i) => blob(i)), blob(400, "images/old.webp")];
  assert.deepEqual(expiredBackups(blobs, NOW), []);
});

test("errors never carry the connection string or the cluster host", () => {
  const uri = "mongodb+srv://cp-backup:s3cret@cluster0.abc12.mongodb.net/?retryWrites=true";
  const text = redact(new Error(`bad auth for ${uri}; querySrv ENOTFOUND _mongodb._tcp.cluster0.abc12.mongodb.net`), uri);
  assert.doesNotMatch(text, /s3cret|cp-backup|abc12|mongodb\.net/);
  assert.match(text, /<connection string>.*<cluster>/);
});

test("the encrypted backup is an OpenPGP message for the backup key only, with no plaintext inside", async () => {
  const plain = new TextEncoder().encode("outfits celebrities PLAINTEXT-MARKER");
  const encrypted = await encryptBackup(plain);
  assert.equal(Buffer.from(encrypted).includes(Buffer.from("PLAINTEXT-MARKER")), false);
  const message = await readMessage({ binaryMessage: encrypted });
  const key = await readKey({ armoredKey: BACKUP_PUBLIC_KEY });
  const recipients = message.getEncryptionKeyIDs().map((id) => id.toHex());
  const subkeys = key.getSubkeys().map((s) => s.getKeyID().toHex());
  assert.deepEqual(recipients, subkeys);
  assert.equal(key.getFingerprint().toUpperCase(), "BCE44AEFE1395657D4B1C8D747826AF9CAFDA1EF");
});
