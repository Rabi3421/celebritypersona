import test from "node:test";
import assert from "node:assert/strict";
import {
  canCancel,
  cleanUrl,
  INBOX_PHOTO,
  instagramPostUrl,
  newLookJobId,
  newLookJobSchema,
  splitUrls,
} from "@/lib/look-jobs";
import { findAdminRoute } from "@/lib/admin-nav";

const ID = "abc123def456";
const PHOTO_PATH = `inbox/${ID}/${ID}-1-0a1b2c3d.webp`;
const PHOTO_URL = `https://firebasestorage.googleapis.com/v0/b/celebritypersona-918fc.firebasestorage.app/o/inbox%2F${ID}%2F${ID}-1-0a1b2c3d.webp?alt=media&token=12345678-1234-1234-1234-123456789abc`;

const form = (over = {}) => ({
  instagramUrl: "https://www.instagram.com/p/DAbc123xyz/",
  buyUrls: "https://www.example-shop.com/dress-1",
  note: "",
  photoPath: "",
  photoUrl: "",
  ...over,
});

test("Instagram posts and reels are reduced to their canonical address", () => {
  assert.equal(instagramPostUrl("https://www.instagram.com/p/DAbc123xyz/?igsh=xyz&img_index=2"), "https://www.instagram.com/p/DAbc123xyz/");
  assert.equal(instagramPostUrl("https://instagram.com/reel/C9-a_b12345"), "https://www.instagram.com/reel/C9-a_b12345/");
  assert.equal(instagramPostUrl("https://www.instagram.com/reels/C9-a_b12345/"), "https://www.instagram.com/reel/C9-a_b12345/");
  assert.equal(instagramPostUrl("https://www.instagram.com/some.star/p/DAbc123xyz/"), "https://www.instagram.com/p/DAbc123xyz/");
});

test("anything that is not one Instagram post is refused", () => {
  for (const bad of [
    "http://www.instagram.com/p/DAbc123xyz/",
    "https://www.instagram.com/some.star/",
    "https://www.instagram.com/stories/some.star/123/",
    "https://instagram.com.evil.example/p/DAbc123xyz/",
    "https://user:pw@www.instagram.com/p/DAbc123xyz/",
    "javascript:alert(1)",
    "",
  ]) {
    assert.equal(instagramPostUrl(bad), null, bad);
  }
});

test("buying links lose tracking tags and fragments but keep what selects the product", () => {
  assert.equal(
    cleanUrl("https://shop.example.com/p/dress?variant=42&utm_source=ig&utm_medium=x&fbclid=abc&gclid=1#reviews"),
    "https://shop.example.com/p/dress?variant=42",
  );
  // Shopify's on-site search tags.
  assert.equal(
    cleanUrl("https://labelkaleido.com/products/ruby-red-gown?_pos=6&_sid=3ba8465f0&_ss=r"),
    "https://labelkaleido.com/products/ruby-red-gown",
  );
  assert.deepEqual(splitUrls(" https://a.example/x \n\nhttps://b.example/y, https://c.example/z "), [
    "https://a.example/x",
    "https://b.example/y",
    "https://c.example/z",
  ]);
});

test("a valid form becomes a job; duplicates collapse and the note is optional", () => {
  const parsed = newLookJobSchema.parse(
    form({ buyUrls: "https://shop.example.com/a?utm_source=x\nhttps://shop.example.com/a", note: "  " }),
  );
  assert.deepEqual(parsed, {
    instagramUrl: "https://www.instagram.com/p/DAbc123xyz/",
    buyUrls: ["https://shop.example.com/a"],
    note: undefined,
  });
});

test("the form refuses bad buying links, too many links and a missing post", () => {
  const issues = (over) => newLookJobSchema.safeParse(form(over)).error?.issues.map((i) => i.path.join(".")) ?? [];
  assert.deepEqual(issues({ buyUrls: "" }), ["buyUrls"]);
  assert.ok(issues({ buyUrls: "http://shop.example.com/a" }).includes("buyUrls.0"));
  assert.ok(issues({ buyUrls: Array.from({ length: 7 }, (_, i) => `https://s.example/${i}`).join("\n") }).includes("buyUrls"));
  assert.deepEqual(issues({ instagramUrl: "" }), ["instagramUrl"]);
});

test("only a photo this page uploaded is accepted, and its URL must name that very file", () => {
  assert.deepEqual(newLookJobSchema.parse(form({ photoPath: PHOTO_PATH, photoUrl: PHOTO_URL })).photo, {
    path: PHOTO_PATH,
    url: PHOTO_URL,
  });
  const photoIssue = (over) =>
    newLookJobSchema.safeParse(form(over)).error?.issues.some((issue) => issue.path[0] === "photo") ?? false;
  assert.ok(photoIssue({ photoPath: `inbox/zzzzzzzzzzzz/zzzzzzzzzzzz-1-0a1b2c3d.webp`, photoUrl: PHOTO_URL }), "a URL for a different file");
  assert.ok(photoIssue({ photoPath: `inbox/abc123def456/zzzzzzzzzzzz-1-0a1b2c3d.webp`, photoUrl: PHOTO_URL }), "a folder and file name that disagree");
  assert.ok(photoIssue({ photoPath: `outfits/some-look/some-look-1-0a1b2c3d.webp`, photoUrl: PHOTO_URL }), "a live outfit's photo");
  assert.ok(photoIssue({ photoPath: PHOTO_PATH, photoUrl: "https://evil.example/x.webp" }), "a foreign URL");
  assert.ok(photoIssue({ photoPath: PHOTO_PATH, photoUrl: "" }), "a path without a URL");
  assert.ok(INBOX_PHOTO.test(`dev/${PHOTO_PATH}`), "development uploads live under dev/");
});

test("job ids are 12 lowercase letters and digits", () => {
  const id = newLookJobId((n) => Uint8Array.from({ length: n }, (_, i) => i * 37));
  assert.match(id, /^[a-z0-9]{12}$/);
  assert.equal(canCancel("queued"), true);
  assert.equal(canCancel("running"), true);
  assert.equal(canCancel("drafted"), false);
});

test("the page has its own title, and outfit edit pages keep theirs", () => {
  assert.equal(findAdminRoute("/admin/outfits/from-links")?.label, "New look from links");
  assert.equal(findAdminRoute("/admin/outfits/12")?.label, "Edit outfit");
  assert.equal(findAdminRoute("/admin/outfits/new")?.label, "New outfit");
});
