import test from "node:test";
import assert from "node:assert/strict";
import { digestLooks, digestSubject, digestWeek, DIGEST_MAX_LOOKS, mailLook } from "@/lib/digest";
import { digestEmail } from "@/lib/mail/templates";

test("weeks are ISO weeks", () => {
  assert.equal(digestWeek(new Date("2026-11-24T10:00:00Z")), "2026-W48");
  assert.equal(digestWeek(new Date("2026-11-29T23:00:00Z")), "2026-W48", "Sunday ends the week");
  assert.equal(digestWeek(new Date("2026-11-30T00:00:00Z")), "2026-W49");
  assert.equal(digestWeek(new Date("2027-01-01T00:00:00Z")), "2026-W53");
});

const piece = { name: "Saree", worn: 12000, wornLink: { retailer: "Shop", url: "https://shop.test/a", network: "none", status: "ok" } };
const look = (id, publishedAt, over = {}) => ({ id, celebrity: `Star ${id}`, event: "Promo", date: "2026-11-01", items: [piece], status: "published", publishedAt, ...over });

test("the digest holds live looks published in the last 7 days, newest first", () => {
  const now = new Date("2026-11-24T10:00:00Z");
  const picked = digestLooks(
    [look(1, "2026-11-17"), look(2, "2026-11-16"), look(3, "2026-11-24"), look(4, "2026-11-20", { status: "draft" }), look(5, undefined)],
    now,
  );
  assert.deepEqual(picked.map((o) => o.id), [3, 1]);
  const many = Array.from({ length: 12 }, (_, i) => look(i + 10, "2026-11-22"));
  assert.equal(digestLooks(many, now).length, DIGEST_MAX_LOOKS);
});

test("the digest mail lists every look with its link and keeps the unsubscribe", () => {
  const looks = [look(1, "2026-11-23"), look(2, "2026-11-22", { celebrity: "A <B>" })].map((o) => mailLook(o, "https://www.celebritypersona.com"));
  const job = { id: "j", outfitId: 0, status: "Queued", subject: digestSubject(2), look: looks[0], digest: { week: "2026-W48", looks }, createdAt: "x", sent: 0, failed: 0, audience: 1 };
  const mail = digestEmail(job, "https://www.celebritypersona.com/api/unsubscribe?token=t");
  assert.equal(job.subject, "This week's 2 looks, decoded");
  for (const one of looks) assert.ok(mail.html.includes(one.url) && mail.text.includes(one.url));
  assert.ok(mail.html.includes("A &lt;B&gt;"));
  assert.ok(mail.html.includes("₹12,000 as worn"));
  assert.ok(mail.text.includes("Unsubscribe: https://www.celebritypersona.com/api/unsubscribe?token=t"));
});
