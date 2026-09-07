import { NextResponse } from "next/server";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { readSession } from "@/lib/auth/session";
import { nameSlug } from "@/lib/slugs";
import { firebaseStorage } from "@/lib/firebase";

/** Images only, and small enough that a stray upload cannot fill the bucket. */
const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * What the bytes say the file is, which is not always what the browser said.
 * `file.type` is client-supplied, so an allowed label can arrive on anything
 * at all; the signature is the part that cannot be typed by hand.
 */
function sniff(bytes: Uint8Array): string | null {
  const is = (offset: number, ...expected: number[]) =>
    expected.every((byte, index) => bytes[offset + index] === byte);
  const ascii = (offset: number, text: string) =>
    [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0));

  if (is(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (is(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  // ISO-BMFF: the brand sits after the box header, and AVIF stills declare
  // "avif" while a sequence declares "avis".
  if (ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"))) return "image/avif";
  return null;
}

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
  const named = (type: string) =>
    `${folder}/${slug}/${Date.now()}-${crypto.randomUUID()}.${extensionFor(type)}`;

  const bytes = new Uint8Array(await file.arrayBuffer());

  // The stored type and the extension come from the signature, never from the
  // label, so nothing can be filed as an image that is not one.
  const actual = sniff(bytes);
  if (!actual || !ALLOWED.includes(actual)) {
    return NextResponse.json(
      { error: "That file is not a JPEG, PNG, WebP or AVIF image." },
      { status: 415 },
    );
  }

  try {
    const path = named(actual);
    const handle = ref(firebaseStorage(), path);
    await uploadBytes(handle, bytes, { contentType: actual });
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
