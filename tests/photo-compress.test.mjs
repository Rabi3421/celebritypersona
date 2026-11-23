import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { compressForStorage, STORED_MAX_BYTES, STORED_WIDTH } from "@/lib/photo-compress";

/** A smooth 3:4 "photo" (gradients, like a studio shot) as a large JPEG. */
const smooth = () =>
  sharp({
    create: { width: 3000, height: 4000, channels: 3, background: { r: 180, g: 30, b: 50 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="3000" height="4000"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="#f4e4d0"/><stop offset="1" stop-color="#5a0e1c"/></linearGradient></defs><rect width="3000" height="4000" fill="url(#g)"/><ellipse cx="1500" cy="2200" rx="700" ry="1500" fill="#b3122e"/></svg>`,
        ),
      },
    ])
    .jpeg({ quality: 95 })
    .toBuffer();

/** Pure noise: the worst case, which no width or quality can make small. */
const noise = (width, height) => {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = Math.floor(Math.random() * 256);
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
};

test("a large photo is stored as WebP, 1200px wide, within 50KB", async () => {
  const stored = await compressForStorage(await smooth());
  const meta = await sharp(stored.bytes).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(stored.width, STORED_WIDTH);
  assert.equal(meta.width, STORED_WIDTH);
  assert.ok(stored.bytes.length <= STORED_MAX_BYTES, `${stored.bytes.length} bytes`);
});

test("a small photo is never enlarged", async () => {
  const stored = await compressForStorage(await sharp(await smooth()).resize({ width: 600 }).toBuffer());
  assert.equal(stored.width, 600);
});

test("a photo too busy for 1200px within the limit is narrowed, and stays WebP", async () => {
  // Noise is beyond any real photo: it is narrowed to the last step and the
  // smallest attempt is kept, rather than the upload failing.
  const stored = await compressForStorage(await noise(1600, 2000));
  assert.ok(stored.width < STORED_WIDTH, "narrowed");
  assert.equal((await sharp(stored.bytes).metadata()).format, "webp");
});

test("something that is not an image is refused", async () => {
  await assert.rejects(compressForStorage(Buffer.from("not an image at all")));
});
