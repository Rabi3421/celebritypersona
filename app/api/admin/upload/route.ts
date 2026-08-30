import { NextResponse } from "next/server";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { readSession } from "@/lib/auth/session";
import { nameSlug } from "@/lib/slugs";
import { firebaseStorage } from "@/lib/firebase";

/** Images only, and small enough that a stray upload cannot fill the bucket. */
const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

const extensionFor = (type: string) =>
  ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" })[type] ??
  "jpg";

export async function POST(request: Request) {
  // The browser never uploads to Firebase directly; it comes through here so
  // the admin session is the thing standing in front of the bucket.
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Use a JPEG, PNG, WebP or AVIF image." },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Image must be under ${MAX_BYTES / 1024 / 1024}MB.` },
      { status: 413 },
    );
  }

  // Every photo for a look lands in one folder named by its slug, so the
  // bucket mirrors the site: outfits/amyra-dastur-savanna-co-ord/....
  // A look saved before it had a slug still needs somewhere to go.
  const folder = nameSlug(String(form.get("folder") ?? "")) || "outfits";
  const slug = nameSlug(String(form.get("slug") ?? "")) || "unfiled";
  const path = `${folder}/${slug}/${Date.now()}-${crypto.randomUUID()}.${extensionFor(file.type)}`;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const handle = ref(firebaseStorage(), path);
    await uploadBytes(handle, bytes, { contentType: file.type });
    const url = await getDownloadURL(handle);
    return NextResponse.json({ url, path });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json(
      { error: `Firebase rejected the upload. ${message}` },
      { status: 502 },
    );
  }
}

/**
 * Only ever the shape this route writes: outfits/<slug>/<stamp>-<uuid>.<ext>.
 * Anything else is refused, so a stray path can never reach deleteObject.
 */
const OWN_UPLOAD = /^[a-z0-9-]+\/[a-z0-9-]+\/\d+-[0-9a-f-]{36}\.(jpg|png|webp|avif)$/;

/**
 * Discards a photo the editor uploaded and then took back. Only worth calling
 * for a file no saved outfit points at yet: once a look references it, the
 * delete belongs to the save, which knows what survived the edit.
 */
export async function DELETE(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!OWN_UPLOAD.test(path)) {
    return NextResponse.json({ error: "Not a path this route wrote." }, { status: 400 });
  }

  try {
    await deleteObject(ref(firebaseStorage(), path));
    return NextResponse.json({ path });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed.";
    return NextResponse.json(
      { error: `Firebase would not delete the file. ${message}` },
      { status: 502 },
    );
  }
}
