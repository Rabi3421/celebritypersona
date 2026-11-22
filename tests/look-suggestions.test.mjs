import test from "node:test";
import assert from "node:assert/strict";
import { cleanCandidates, SUGGESTIONS_PER_DAY } from "@/lib/look-suggestions";

const candidate = (over = {}) => ({
  celebrity: "Example Star",
  event: "Film premiere in Mumbai",
  date: "2026-11-21",
  instagramUrl: "https://www.instagram.com/p/DAbc123xyz/?igsh=abc",
  buyUrls: ["https://label.example.com/products/gown?utm_source=ig"],
  why: "Covered by three outlets this morning; the gown is credited to Label Example.",
  score: 7,
  sources: ["https://news.example.com/star-premiere"],
  ...over,
});

test("a good candidate is kept with its post and links cleaned", () => {
  const { kept, dropped } = cleanCandidates([candidate()], []);
  assert.equal(dropped.length, 0);
  assert.equal(kept[0].instagramUrl, "https://www.instagram.com/p/DAbc123xyz/");
  assert.deepEqual(kept[0].buyUrls, ["https://label.example.com/products/gown"]);
});

test("covered posts, missing buying links, non-posts and bad shapes are left out, with reasons", () => {
  const { kept, dropped } = cleanCandidates(
    [
      candidate({ instagramUrl: "https://www.instagram.com/p/COVERED1/" }),
      candidate({ instagramUrl: "https://www.instagram.com/p/NOLINK11/", buyUrls: ["https://www.instagram.com/label/"] }),
      candidate({ instagramUrl: "https://www.instagram.com/examplestar/" }),
      { celebrity: "x" },
      candidate({ instagramUrl: "https://www.instagram.com/p/DUPLICATE/" }),
      candidate({ instagramUrl: "https://www.instagram.com/p/DUPLICATE/?img_index=2" }),
    ],
    ["https://www.instagram.com/p/COVERED1/"],
  );
  assert.equal(kept.length, 1, "only the first of the duplicate pair survives");
  assert.ok(dropped.some((reason) => reason.includes("already covered")));
  assert.ok(dropped.some((reason) => reason.includes("no page that sells")));
  assert.ok(dropped.some((reason) => reason.includes("not a single Instagram post")));
  assert.ok(dropped.some((reason) => reason.includes("expected shape")));
});

test("only the best few by score are kept", () => {
  const many = Array.from({ length: 8 }, (_, i) => candidate({ instagramUrl: `https://www.instagram.com/p/POST${i}abc/`, score: i + 1 }));
  const { kept } = cleanCandidates(many, []);
  assert.equal(kept.length, SUGGESTIONS_PER_DAY);
  assert.deepEqual(kept.map((item) => item.score), [8, 7, 6, 5, 4]);
});
