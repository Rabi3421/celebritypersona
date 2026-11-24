import test from "node:test";
import assert from "node:assert/strict";
import { latestBackup, summariseLookJobs } from "@/lib/report/site-events";

test("finished jobs are named after their draft; failures carry the reason, nothing else leaks", () => {
  const jobs = [
    {
      id: "aaaaaaaaaaaa",
      status: "drafted",
      finishedAt: "2026-11-21T10:00:00.000Z",
      instagramUrl: "https://www.instagram.com/p/A/",
      buyUrls: ["https://shop.example.com/a"],
      outfitId: 37,
      findings: { evidence: [{ claim: "secret research text", sources: [], confidence: "likely" }], checks: ["a", "b"], by: ["claude", "codex"] },
    },
    { id: "bbbbbbbbbbbb", status: "failed", finishedAt: "2026-11-21T11:00:00.000Z", instagramUrl: "https://www.instagram.com/p/B/", buyUrls: [], error: "Claude did not finish." },
    { id: "cccccccccccc", status: "running", instagramUrl: "https://www.instagram.com/p/C/", buyUrls: [] },
  ];
  const rows = summariseLookJobs(jobs, [{ id: 37, celebrity: "Example Star", event: "Promotions" }]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    id: "aaaaaaaaaaaa",
    status: "drafted",
    finishedAt: "2026-11-21T10:00:00.000Z",
    instagramUrl: "https://www.instagram.com/p/A/",
    outfitId: 37,
    celebrity: "Example Star",
    event: "Promotions",
    checks: 2,
    by: ["claude", "codex"],
    error: null,
  });
  assert.equal(rows[1].error, "Claude did not finish.");
  assert.ok(!JSON.stringify(rows).includes("secret research text"));
});

test("the newest backup is found; an empty store says so", () => {
  assert.deepEqual(
    latestBackup([
      { pathname: "backups/backup-2026-11-19T20-30-01Z.json.gz.gpg", uploadedAt: "2026-11-19T20:30:05.000Z" },
      { pathname: "backups/backup-2026-11-20T20-30-01Z.json.gz.gpg", uploadedAt: new Date("2026-11-20T20:30:04.000Z") },
      { pathname: "backups/notes.txt", uploadedAt: "2026-11-21T00:00:00.000Z" },
    ]),
    { latestAt: "2026-11-20T20:30:04.000Z", count: 2 },
  );
  assert.deepEqual(latestBackup([]), { latestAt: null, count: 0 });
});

test("published looks in the window carry their page, pin image and description", async () => {
  const { summarisePublished } = await import("@/lib/report/site-events");
  const piece = { name: "Saree", worn: 12000, wornLink: { retailer: "Shop", url: "https://shop.test/a", network: "none", status: "ok" } };
  const look = (over) => ({ id: 1, celebrity: "Kiara Advani", event: "Promo Tour", date: "2026-11-20", items: [piece], status: "published", publishedAt: "2026-11-23", ...over });
  const out = summarisePublished(
    [
      look({ seoDescription: "Kiara's red saree, priced." }),
      look({ id: 2, publishedAt: "2026-10-01" }),
      look({ id: 3, status: "draft", publishedAt: undefined }),
    ],
    new Date("2026-11-21T00:00:00Z"),
    "https://www.celebritypersona.com/",
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 1);
  assert.match(out[0].url, /^https:\/\/www\.celebritypersona\.com\/outfits\/[a-z0-9-]+$/);
  assert.ok(out[0].pinImage.startsWith(`${out[0].url}/pin.png?v=`), out[0].pinImage);
  assert.equal(out[0].pinDescription, "Kiara's red saree, priced.");
});
