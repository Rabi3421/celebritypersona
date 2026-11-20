/**
 * Read-only check of who can reach the photo bucket.
 *
 *     npm run storage:check
 *
 *  1. The uploader account signs in and lists one file: this must work, or the
 *     admin cannot upload or delete photos.
 *  2. An anonymous request tries to list the bucket: once the locked rules are
 *     published this must be refused (403).
 *
 * Nothing is written or deleted.
 */
import { list, ref } from "firebase/storage";
import { uploaderStorage } from "@/lib/firebase";

const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

async function main() {
  let ok = true;

  try {
    const storage = await uploaderStorage();
    const page = await list(ref(storage, "outfits"), { maxResults: 1 });
    console.log(`OK    uploader signs in and can list the bucket (${page.prefixes.length + page.items.length} entry seen).`);
  } catch (error) {
    ok = false;
    const code = (error as { code?: string }).code ?? (error instanceof Error ? error.message : String(error));
    console.log(`FAIL  uploader could not sign in or list: ${code}`);
  }

  const response = await fetch(`https://firebasestorage.googleapis.com/v0/b/${bucket}/o?maxResults=1`);
  if (response.status === 200) {
    console.log("OPEN  anonymous visitors can still list the bucket (the old rules are in place).");
  } else {
    console.log(`OK    anonymous listing refused (${response.status}).`);
  }

  process.exitCode = ok ? 0 : 1;
}

main().finally(() => setTimeout(() => process.exit(), 100));
