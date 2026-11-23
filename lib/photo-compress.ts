import "server-only";
import sharp from "sharp";

/**
 * The final form of every photo stored for a look: WebP, at most 50KB, and
 * 1200px wide whenever that can be had within the 50KB.
 *
 * 1200px is Google Discover's minimum for a large image card, so width is the
 * last thing given up: quality is searched first, at full width, and only a
 * photo too detailed to fit even at the lowest acceptable quality is narrowed.
 *
 * Done here rather than in the browser because sharp's encoder (effort 6,
 * smart subsampling) fits the same photo in roughly half the bytes the
 * browser's canvas encoder needs. The browser still shrinks first, so the
 * upload stays under the platform's request limit.
 */

export const STORED_MAX_BYTES = 50 * 1024;
/** Discover's large-card minimum; never enlarged to reach it. */
export const STORED_WIDTH = 1200;
/** Tried in turn only when 1200px cannot fit at the lowest quality. */
const NARROWER = [1080, 960, 800];
/** Below this, fabric texture turns to blotches. */
const MIN_QUALITY = 40;
const MAX_QUALITY = 82;

export type StoredPhoto = { bytes: Buffer; width: number; height: number; quality: number };

async function encode(source: Buffer, width: number, quality: number) {
  const { data, info } = await sharp(source, { failOn: "error" })
    .rotate() // Applies the camera's orientation, then drops the tag with the rest of the metadata.
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 6, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });
  return { bytes: data, width: info.width, height: info.height, quality };
}

/** Highest quality at this width that fits, or the smallest it gets. */
async function bestAt(source: Buffer, width: number, limit: number) {
  let low = MIN_QUALITY;
  let high = MAX_QUALITY;
  let best: StoredPhoto | null = null;
  const top = await encode(source, width, MAX_QUALITY);
  if (top.bytes.length <= limit) return top;
  for (let pass = 0; pass < 5; pass += 1) {
    const quality = Math.round((low + high) / 2);
    const result = await encode(source, width, quality);
    if (result.bytes.length <= limit) {
      best = result;
      low = quality;
    } else {
      high = quality;
    }
    if (high - low <= 1) break;
  }
  return best ?? (await encode(source, width, MIN_QUALITY));
}

/** Throws when the bytes are not an image sharp can read. */
export async function compressForStorage(source: Buffer, limit = STORED_MAX_BYTES): Promise<StoredPhoto> {
  let smallest: StoredPhoto | null = null;
  for (const width of [STORED_WIDTH, ...NARROWER]) {
    const result = await bestAt(source, width, limit);
    if (!smallest || result.bytes.length < smallest.bytes.length) smallest = result;
    if (result.bytes.length <= limit) return result;
    // A photo already narrower than the next step cannot get any smaller by width.
    if (result.width < width) break;
  }
  return smallest as StoredPhoto;
}
