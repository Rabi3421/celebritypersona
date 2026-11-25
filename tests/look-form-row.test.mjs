import test from "node:test";
import assert from "node:assert/strict";
import { instagramProfileUrl, newLookJobSchema, parseSheetRow } from "@/lib/look-jobs";

// Shaped like a row copied from the editor's sheet: NAME, CELEBRITY INSTAGRAM, WEBSITE,
// ORIGINAL OUTFIT, INSTAGRAM POST, Status, Alternate — separated by tabs.
const row = (...cells) => cells.join("\t");

test("a full row fills every field, status ignored", () => {
  const out = parseSheetRow(
    row(
      "Shakti Mohan",
      "https://www.instagram.com/mohanshakti?utm_source=ig_web_button_share_sheet&dmpr=ZDNlZDc0MzlxNw==",
      "https://www.missmosa.in/",
      "https://www.missmosa.in/collections/dresses/products/ilana-corset-gathered-slit-maxi-dress",
      "https://www.instagram.com/p/Df45bUKjf9L/?utm_source=ig_web_copy_link&cnvx=NTc4MTIwNjQ2YQ==",
      "Pending",
      "https://outcasts.in/products/sienna-midnight-slit-maxi-dress",
    ),
  );
  assert.deepEqual(out, {
    celebrity: "Shakti Mohan",
    celebrityInstagram: "https://www.instagram.com/mohanshakti/",
    labelUrl: "https://www.missmosa.in/",
    buyUrls: "https://www.missmosa.in/collections/dresses/products/ilana-corset-gathered-slit-maxi-dress",
    instagramUrl: "https://www.instagram.com/p/Df45bUKjf9L/",
    alternateUrls: "https://outcasts.in/products/sienna-midnight-slit-maxi-dress",
  });
});

test("an empty Alternate column leaves alternates empty", () => {
  const out = parseSheetRow(
    row("Kajal Aggarwal", "https://www.instagram.com/kajalaggarwalofficial/", "https://www.endource.com/", "https://www.endource.com/product/and-other-stories-ruffled-strapless-midi-dress/XtkteEbg-wABtDAP", "https://www.instagram.com/p/DgII8e8jCQh/", "Pending", ""),
  );
  assert.equal(out.celebrity, "Kajal Aggarwal");
  assert.equal(out.alternateUrls, "");
  assert.equal(out.buyUrls, "https://www.endource.com/product/and-other-stories-ruffled-strapless-midi-dress/XtkteEbg-wABtDAP");
});

test("cells are recognised by content, not position", () => {
  const out = parseSheetRow(row("https://www.instagram.com/reel/DgFERhGCLM2/", "Shriya Pilgaonkar", "https://www.basilleaf.in/products/printed-red-tissue-saree?variant=1", "https://www.basilleaf.in/", "Pending"));
  assert.equal(out.instagramUrl, "https://www.instagram.com/reel/DgFERhGCLM2/");
  assert.equal(out.celebrity, "Shriya Pilgaonkar");
  assert.equal(out.labelUrl, "https://www.basilleaf.in/");
  assert.match(out.buyUrls, /printed-red-tissue-saree/);
});

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
