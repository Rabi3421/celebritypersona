import { mkdir, writeFile } from "node:fs/promises";

/**
 * Writes the documents a script is about to change, before it changes them.
 *
 * Every production write is now approved one at a time, and every approval
 * carries the same condition: a backup of the affected documents, taken
 * immediately before the write. Encoding it here rather than leaving it to
 * whoever writes the next script is the difference between a rule and a habit.
 *
 * The file is named for the script and the moment, so two runs never overwrite
 * each other and the order is obvious from the directory listing. It holds the
 * documents exactly as they were read, so restoring is a mongoimport rather
 * than a reconstruction.
 *
 * Throws on failure, deliberately. A write whose backup did not happen is a
 * write that should not happen.
 */
export async function backupDocuments(
  label: string,
  documents: readonly unknown[],
): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `.scratch/backup-${label}-${stamp}.json`;

  await mkdir(".scratch", { recursive: true });
  await writeFile(path, JSON.stringify(documents, null, 2));

  console.log(
    `Backed up ${documents.length} document${documents.length === 1 ? "" : "s"} to ${path}`,
  );
  return path;
}
