import test from "node:test";
import assert from "node:assert/strict";
import { instagramProfileUrl, newLookJobSchema } from "@/lib/look-jobs";

test("profile links are told apart from post links", () => {
  assert.equal(instagramProfileUrl("https://instagram.com/vedikapinto?utm_source=x"), "https://www.instagram.com/vedikapinto/");
  assert.equal(instagramProfileUrl("https://www.instagram.com/p/Df7MlN0ju8W/"), null);
  assert.equal(instagramProfileUrl("https://www.instagram.com/reel/abc123/"), null);
  assert.equal(instagramProfileUrl("https://example.com/vedikapinto"), null);
});

test("the form's fields are validated and cleaned", () => {
  const ok = newLookJobSchema.safeParse({
    instagramUrl: "https://www.instagram.com/p/Df45bUKjf9L/?utm_source=ig_web_copy_link",
    buyUrls: "https://www.missmosa.in/products/ilana?utm_source=x",
    celebrity: "  Shakti Mohan ",
    celebrityInstagram: "https://www.instagram.com/mohanshakti?igsh=abc",
    labelUrl: "https://www.missmosa.in/?utm_source=sheet",
    alternateUrls: "https://outcasts.in/products/sienna?utm_campaign=x\nhttps://outcasts.in/products/sienna",
    note: "",
    photoPath: "",
    photoUrl: "",
  });
  assert.ok(ok.success, JSON.stringify(ok.error?.issues));
  assert.equal(ok.data.celebrity, "Shakti Mohan");
  assert.equal(ok.data.celebrityInstagram, "https://www.instagram.com/mohanshakti/");
  assert.equal(ok.data.labelUrl, "https://www.missmosa.in/");
  assert.deepEqual(ok.data.alternateUrls, ["https://outcasts.in/products/sienna"]);

  const bad = newLookJobSchema.safeParse({
    instagramUrl: "https://www.instagram.com/p/Df45bUKjf9L/",
    buyUrls: "https://www.missmosa.in/products/ilana",
    celebrityInstagram: "https://www.instagram.com/p/Df45bUKjf9L/",
    labelUrl: "missmosa.in",
    alternateUrls: "http://a.test/1 https://a.test/2 https://a.test/3 https://a.test/4",
    note: "", photoPath: "", photoUrl: "",
  });
  assert.equal(bad.success, false);
  const paths = bad.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("celebrityInstagram") && paths.includes("labelUrl") && paths.some((p) => p.startsWith("alternateUrls")), paths.join(","));
});

test("older jobs and scout jobs without the new fields still validate", () => {
  const old = newLookJobSchema.safeParse({ instagramUrl: "https://www.instagram.com/p/Df45bUKjf9L/", buyUrls: "https://shop.test/a", note: "", photoPath: "", photoUrl: "" });
  assert.ok(old.success);
  assert.equal(old.data.alternateUrls, undefined);
  assert.equal(old.data.celebrity, undefined);
});
