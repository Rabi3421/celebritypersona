/**
 * Shrinks a photo in the browser before it is uploaded; the server then makes
 * the stored 50KB WebP from it.
 *
 * Storage is the reason: a bucket filled with 1MB originals runs out fast, and
 * every one of them has to be fetched before it can be served. Compressing here
 * rather than on the server also means the original never crosses the network.
 *
 * The result is WebP, which at these sizes is markedly smaller than JPEG for
 * the same quality. Nothing here can throw: a photo that cannot be decoded is
 * returned untouched so the upload still happens.
 */

import { safeFileName } from "@/lib/file-names";

/**
 * Only the first, light shrink. The server makes the stored file (WebP, at
 * most 50KB, 1200px wide; see lib/photo-compress.ts), with an encoder that
 * fits far more into those bytes than the browser's. This step just keeps a
 * phone photo well under the platform's 4.5MB request limit, and leaves the
 * server a clean, high-quality source to work from.
 */
export const TARGET_BYTES = 1200 * 1024;

/** Comfortably above the 1200px width the server keeps. */
const MAX_EDGE = 2400;

/** Tried in turn when the target cannot be met at the size above. */
const NARROWER = [2000, 1600];

/** High on purpose: the server compresses again, and artefacts would compound. */
const MIN_QUALITY = 0.6;
const MAX_QUALITY = 0.92;

export type Compressed = {
  file: File;
  /** Bytes before and after, for the editor to see what happened. */
  from: number;
  to: number;
};

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );

/** Draws the bitmap scaled so its longest edge is at most `edge`. */
function drawScaled(bitmap: ImageBitmap, edge: number) {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Binary search for the highest quality that still fits the target. Six passes
 * land within about one percent of the best quality available, which is finer
 * than the encoder itself resolves.
 */
async function bestUnder(canvas: HTMLCanvasElement, target: number) {
  let low = MIN_QUALITY;
  let high = MAX_QUALITY;
  let best: Blob | null = null;

  for (let pass = 0; pass < 6; pass += 1) {
    const quality = (low + high) / 2;
    const blob = await toBlob(canvas, quality);
    if (!blob) break;
    if (blob.size <= target) {
      best = blob;
      low = quality;
    } else {
      high = quality;
    }
  }

  // Nothing fit, so report the smallest this size can manage: the caller
  // decides whether to try again at a smaller edge.
  return best ?? (await toBlob(canvas, MIN_QUALITY));
}

export async function compressImage(
  file: File,
  target = TARGET_BYTES,
): Promise<Compressed> {
  const untouched = { file, from: file.size, to: file.size };

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // An unreadable or unsupported file. Let the server have its say.
    return untouched;
  }

  try {
    // Start no larger than the photo itself, then only ever step down. The
    // edge caps the longest side, so this holds for portrait and landscape
    // alike — the shot is never stretched to reach a step.
    const longest = Math.max(bitmap.width, bitmap.height);
    const first = Math.min(MAX_EDGE, longest);
    const edges = [first, ...NARROWER.filter((edge) => edge < first)];

    let smallest: Blob | null = null;
    for (const edge of edges) {
      const canvas = drawScaled(bitmap, edge);
      if (!canvas) break;
      const blob = await bestUnder(canvas, target);
      if (!blob) break;
      if (!smallest || blob.size < smallest.size) smallest = blob;
      if (blob.size <= target) break;
    }

    // Already smaller than anything we can produce, e.g. a tiny WebP.
    if (!smallest || smallest.size >= file.size) return untouched;

    const name = `${safeFileName(file.name.replace(/\.[^.]+$/, ""))}.webp`;
    return {
      file: new File([smallest], name, { type: "image/webp" }),
      from: file.size,
      to: smallest.size,
    };
  } finally {
    bitmap.close();
  }
}

/** "1.2 MB", "46 KB" — for the line the editor reads after an upload. */
export const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
