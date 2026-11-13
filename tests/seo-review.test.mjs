// The pre-publish SEO research and review (lib/seo-review). Pure modules and an
// in-memory repository only: nothing here touches MongoDB.
import { test } from "node:test";
import assert from "node:assert/strict";
import { confidenceOf, demandSummary, evidenceProblems, parseRange } from "../lib/seo-review/evidence.ts";
import { classifyIntent, keywordIdeas, keywordOverlaps, relevance } from "../lib/seo-review/keyword.ts";
import { auditFindings, phraseCount } from "../lib/seo-review/audit.ts";
import { buildReview, READINESS_DISCLAIMER } from "../lib/seo-review/review.ts";
import { attachPrepared, loadReview, parseKey, parseReviewPayload, reviewKey, saveReview, serpObservations } from "../lib/seo-review/store.ts";
import { buildSiteContext } from "../lib/seo-review/site-context.ts";
import { seoChecks } from "../lib/seo-checks.ts";

const TODAY = "2026-11-13";

// ------------------------------------------------------------------ fixtures (synthetic)

const ABOUT = [
  "Rukmini Vasanth's black dress for the Back to Black shoot is Club L London's bardot buckle midi, an off-shoulder corset cut with sheer mesh sleeves and a silver buckle at the bust.",
  "The fabric is a stretch crepe with boning through the bodice, so the shape holds without a belt. The mesh sleeves stop at the wrist and are lined at the shoulder.",
  "It works well past a photoshoot: a cocktail party, a date night or New Year's Eve. Pair it with strappy black heels and a small clutch, and keep jewellery to one pair of studs so the neckline stays the focus.",
  "Club L London sells it for ₹9,600. Our swap from a high-street label costs ₹2,450 and copies the bardot neckline and the buckle, though its sleeves are opaque rather than mesh.",
  "If you are between sizes, size up: the corset bodice runs small and has little give across the ribs, while the skirt is cut straight and forgiving.",
];

function look(over = {}) {
  return {
    celebrity: "Rukmini Vasanth",
    event: "Back to Black photoshoot",
    occasion: "Party",
    occasions: ["Party", "Date night"],
    date: "2026-11-01",
    slug: "rukmini-vasanth-black-dress-club-l-london",
    seoTitle: "Rukmini Vasanth's Black Dress by Club L London",
    seoDescription: "Rukmini Vasanth black dress: the Club L London bardot buckle midi she wore for Back to Black. Get the lookalike for ₹2,450.",
    primaryKeyword: "rukmini vasanth black dress",
    secondaryKeywords: ["club l london bardot dress"],
    status: "draft",
    notes: ABOUT,
    photoCredit: "Instagram / @rukminivasanth",
    images: [
      { url: "https://img.example/1.jpg", alt: "Rukmini Vasanth in a black Club L London dress at the Back to Black shoot" },
      { url: "https://img.example/2.jpg", alt: "Rukmini Vasanth's dress, detail of the buckle" },
    ],
    items: [
      { id: "p1", name: "Bardot buckle midi dress", category: "dress", colours: ["black"], wornBrand: "Club L London", worn: 9600, swapBrand: "High Street", swap: 2450 },
      { id: "p2", name: "Strappy heels", category: "heels", colours: ["black"], wornBrand: "Steve Madden", worn: 7999 },
    ],
    leadPieceId: "p1",
    leadChosen: true,
    faqs: [],
    links: [
      { piece: "Bardot buckle midi dress", side: "original", url: "https://clubl.example/p", status: "ok" },
      { piece: "Bardot buckle midi dress", side: "swap", url: "https://shop.example/s", status: "ok", affiliateUrl: "https://aff.example/s", network: "cuelinks" },
    ],
    ...over,
  };
}

function context(over = {}) {
  return {
    owners: [],
    others: [],
    celebrities: [{ name: "Rukmini Vasanth", slug: "", looks: 2, introWords: 0, record: true }],
    occasions: [{ name: "Party", slug: "", looks: 3, introWords: 0, record: true }],
    today: TODAY,
    ...over,
  };
}

const finding = (findings, id) => findings.find((f) => f.id === id);
const kp = (over = {}) => ({ id: "e1", source: "keyword-planner", value: "100–1K", period: "last 12 months", market: "IN", collectedAt: "2026-11-10", ...over });

// ------------------------------------------------------------------ evidence

test("evidence: Keyword Planner ranges parse in Google's own format; nonsense is refused", () => {
  assert.deepEqual(parseRange("100–1K"), { low: 100, high: 1000 });
  assert.deepEqual(parseRange("1K - 10K"), { low: 1000, high: 10000 });
  assert.deepEqual(parseRange("10 to 100"), { low: 10, high: 100 });
  assert.equal(parseRange("1K–100"), null, "low above high");
  assert.equal(parseRange("lots"), null);
  assert.deepEqual(evidenceProblems(kp(), TODAY), []);
  assert.match(evidenceProblems(kp({ value: "about 500" }), TODAY)[0], /range as shown/);
});

test("evidence: every item needs a source, value, period, market and a real lookup date; 'other' needs a link", () => {
  assert.deepEqual(evidenceProblems({}, TODAY), ["Choose where this came from."]);
  const all = evidenceProblems(kp({ value: "", period: "", market: "India", collectedAt: "2026-13-01" }), TODAY).join(" ");
  assert.match(all, /exactly as/);
  assert.match(all, /which period/);
  assert.match(all, /two-letter/);
  assert.match(all, /day you looked it up/);
  assert.match(evidenceProblems(kp({ collectedAt: "2026-11-20" }), TODAY).join(), /future/);
  assert.match(evidenceProblems(kp({ source: "google-trends", value: "140" }), TODAY).join(), /0 to 100/);
  assert.match(evidenceProblems(kp({ source: "search-console", value: "12.5" }), TODAY).join(), /whole number/);
  assert.match(evidenceProblems(kp({ source: "other", value: "x" }), TODAY).join(), /re-checked/);
  assert.match(evidenceProblems(kp({ url: "http://insecure.example" }), TODAY).join(), /https/);
  assert.match(evidenceProblems(kp({ url: "javascript:alert(1)" }), TODAY).join(), /https/);
});

test("evidence: confidence follows the source, and drops for stale lookups and other markets", () => {
  assert.equal(confidenceOf(kp({ source: "search-console", value: "64" }), TODAY).level, "high");
  assert.equal(confidenceOf(kp(), TODAY).level, "medium");
  assert.equal(confidenceOf(kp({ source: "google-trends", value: "40" }), TODAY).level, "low");
  const stale = confidenceOf(kp({ collectedAt: "2026-01-01" }), TODAY);
  assert.equal(stale.level, "low");
  assert.match(stale.reasons.join(" "), /days ago/);
  const abroad = confidenceOf(kp({ market: "US" }), TODAY);
  assert.equal(abroad.level, "low");
  assert.match(abroad.reasons.join(" "), /not India/);
});

test("evidence: no evidence is 'unknown, not zero'; a recorded 0 is evidence; nothing is summed or estimated", () => {
  const none = demandSummary([], TODAY);
  assert.equal(none.status, "none");
  assert.match(none.statement, /Unknown — not zero/);
  const zero = demandSummary([kp({ source: "search-console", value: "0", period: "last 28 days" })], TODAY);
  assert.equal(zero.status, "evidence");
  assert.match(zero.statement, /0 impressions/);
  const two = demandSummary([kp(), kp({ id: "e2", source: "bing-webmaster", value: "300", period: "last 4 weeks" })], TODAY);
  assert.equal(two.count, 2);
  assert.equal(two.strongest, "medium", "Keyword Planner outranks Bing for Google demand");
  assert.doesNotMatch(two.statement, /1,?300|total|estimate|traffic|volume/i, "values are never added up or turned into volume");
  assert.equal(demandSummary([kp({ value: "garbage" })], TODAY).status, "none", "invalid evidence is not evidence");
});

// ------------------------------------------------------------------ keywords

test("intent: outfit, buy, inspiration and news searches are told apart, with the words that decided it", () => {
  const c = "Rukmini Vasanth";
  assert.equal(classifyIntent("rukmini vasanth black dress", c).intent, "identify-outfit");
  assert.equal(classifyIntent("rukmini vasanth black dress price", c).intent, "buy");
  assert.deepEqual(classifyIntent("rukmini vasanth dress where to buy", c).signals, ["where", "buy"]);
  assert.equal(classifyIntent("rukmini vasanth saree styling ideas", c).intent, "style-inspiration");
  assert.equal(classifyIntent("rukmini vasanth age", c).intent, "celebrity-news");
  assert.equal(classifyIntent("rukmini vasanth", c).intent, "celebrity-news");
  assert.equal(classifyIntent("rukmini vasanth age", c).fitsPage, false);
  assert.equal(classifyIntent("", c).intent, "unclear");
});

test("relevance: the keyword is checked against this exact look; a wrong garment or colour is a mismatch", () => {
  const facts = { celebrity: "Rukmini Vasanth", event: "Back to Black photoshoot", occasions: ["Party"], items: look().items };
  const good = relevance("rukmini vasanth black dress club l london", facts);
  assert.deepEqual([good.celebrity.status, good.garment.status, good.colour.status, good.brand.status], ["match", "match", "match", "match"]);
  assert.deepEqual(good.mismatches, []);
  const wrong = relevance("rukmini red saree", facts);
  assert.equal(wrong.celebrity.status, "partial");
  assert.equal(wrong.garment.status, "mismatch");
  assert.equal(wrong.colour.status, "mismatch");
  assert.equal(wrong.mismatches.length, 2);
  assert.equal(relevance("rukmini vasanth party look", facts).occasion.status, "match");
  assert.equal(relevance("rukmini vasanth black dress", facts).occasion.status, "absent", "“Back to Black” is an event name, not an occasion match for the colour");
  assert.equal(relevance("rukmini vasanth back to black dress", facts).occasion.status, "match");
});

test("overlap: same keyword, a near-identical keyword, and a live title that already covers it", () => {
  const others = [
    { id: 2, slug: "a", title: "Someone's Dress", celebrity: "X", published: true, keywords: ["rukmini vasanth black dress"], notes: "" },
    { id: 3, slug: "b", title: "Other", celebrity: "X", published: false, keywords: ["rukmini vasanth black midi dress"], notes: "" },
    { id: 4, slug: "c", title: "Rukmini Vasanth's Black Dress at the Airport", celebrity: "Rukmini Vasanth", published: true, keywords: [], notes: "" },
    { id: 9, slug: "self", title: "Self", celebrity: "X", published: true, keywords: ["rukmini vasanth black dress"], notes: "" },
  ];
  const found = keywordOverlaps("Rukmini Vasanth black dress", others, 9);
  assert.deepEqual(found.map((o) => [o.id, o.kind]), [[2, "same-keyword"], [3, "similar-keyword"], [4, "similar-title"]]);
  assert.deepEqual(keywordOverlaps("", others), []);
});

test("keyword ideas come only from the look's own facts", () => {
  const ideas = keywordIdeas({ ...look(), occasions: ["Party"] });
  assert.ok(ideas.includes("rukmini vasanth black dress"));
  assert.ok(ideas.includes("rukmini vasanth club l london dress"));
  assert.ok(ideas.every((idea) => !/\d/.test(idea)), "no numbers, no volumes");
  assert.deepEqual(keywordIdeas({ ...look(), celebrity: "" }), []);
});

// ------------------------------------------------------------------ content review

test("review: a complete look has no blockers, and readiness is labelled as not a traffic prediction", () => {
  const review = buildReview(look(), context());
  assert.deepEqual(review.blockers, []);
  assert.equal(review.readiness.disclaimer, READINESS_DISCLAIMER);
  assert.match(READINESS_DISCLAIMER, /not a prediction of Google traffic/);
  assert.ok(review.readiness.percent >= 85, `readiness ${review.readiness.percent}%`);
  assert.equal(review.primary.demand.status, "none", "demand is reported separately and is unknown without evidence");
});

test("publishing safeguards: blockers are exactly the existing checklist's failing critical checks", () => {
  for (const variant of [look(), look({ primaryKeyword: "" }), look({ images: [] }), look({ notes: ["Too short."] }), look({ leadChosen: false, leadPieceId: undefined })]) {
    const expected = seoChecks(variant, { owners: [] }).filter((c) => c.level === "critical" && !c.ok).map((c) => `checklist:${c.id}`).sort();
    const review = buildReview(variant, context());
    assert.deepEqual(review.blockers.map((f) => f.id).sort(), expected);
    assert.ok(review.recommendations.every((f) => f.kind === "editorial"), "editorial advice never becomes a blocker");
  }
});

test("review: never changes the look it reads", () => {
  const input = look({ seoTitle: undefined, seoDescription: undefined });
  const frozen = structuredClone(input);
  buildReview(input, context());
  assert.deepEqual(input, frozen);
});

test("review: a keyword that describes a different outfit is a high-priority finding", () => {
  const f = auditFindings(look({ primaryKeyword: "rukmini vasanth red saree" }), context());
  const fit = finding(f, "keyword-matches-look");
  assert.equal(fit.ok, false);
  assert.equal(fit.severity, "high");
  assert.match(fit.explanation, /saree/);
  assert.equal(finding(f, "keyword-intent").ok, true);
  assert.equal(finding(auditFindings(look({ primaryKeyword: "rukmini vasanth husband" }), context()), "keyword-intent").ok, false);
});

test("review: generic AI-sounding writing, keyword stuffing and repeated sentences are flagged", () => {
  const stuffed = look({
    notes: [
      "Rukmini Vasanth black dress is a stunning ensemble that exudes effortless elegance. Rukmini Vasanth black dress elevates her style.",
      "Rukmini Vasanth black dress turned heads. Rukmini Vasanth black dress is a testament to her taste. The look is a testament to her taste and style overall.",
      "The look is a testament to her taste and style overall.",
    ],
  });
  const f = auditFindings(stuffed, context());
  assert.equal(finding(f, "content-generic").ok, false);
  assert.match(finding(f, "content-generic").explanation, /stunning ensemble/);
  assert.equal(finding(f, "content-stuffing").ok, false);
  assert.equal(phraseCount(stuffed.notes.join(" "), "rukmini vasanth black dress"), 4);
  assert.equal(finding(f, "content-repetition").ok, false);
  const clean = auditFindings(look(), context());
  for (const id of ["content-generic", "content-stuffing", "content-repetition", "content-names-pieces"]) assert.equal(finding(clean, id).ok, true, id);
});

test("review: writing reused from another look is found and named", () => {
  const other = { id: 7, slug: "older-look", title: "An Older Look", celebrity: "X", published: true, keywords: [], notes: ABOUT.join("\n") };
  const f = finding(auditFindings(look(), context({ others: [other] })), "content-original");
  assert.equal(f.ok, false);
  assert.equal(f.severity, "high");
  assert.match(f.explanation, /An Older Look/);
});

test("review: product identity, link verification and affiliate labelling", () => {
  const f = auditFindings(
    look({
      items: [{ id: "p1", name: "Midi dress", category: "dress", colours: ["black"], swapBrand: "S", swap: 2000 }],
      links: [
        { piece: "Midi dress", side: "original", url: "https://x.example", status: "dead" },
        { piece: "Midi dress", side: "swap", url: "https://y.example", status: "unverified", affiliateUrl: "https://aff.example", network: "none" },
      ],
    }),
    context(),
  );
  assert.equal(finding(f, "products-lead-identified").ok, false);
  assert.equal(finding(f, "products-dead-links").severity, "high");
  assert.equal(finding(f, "products-dead-links").ok, false);
  assert.equal(finding(f, "products-verified").ok, false);
  assert.equal(finding(f, "pricing-disclosure").ok, false);
  assert.match(finding(f, "pricing-disclosure").explanation, /disclosure automatically/);
  assert.equal(finding(auditFindings(look({ items: [{ ...look().items[0], worn: 96 }] }), context()), "pricing-plausible").ok, false);
});

test("review: titles, descriptions and slugs get copy-ready suggestions, never applied automatically", () => {
  const input = look({ seoTitle: "OUTFIT LOOK OUTFIT LOOK OUTFIT", seoDescription: undefined, slug: "Rukmini_Dress 2026" });
  const f = auditFindings(input, context());
  assert.equal(finding(f, "title-stuffing").ok, false);
  assert.equal(finding(f, "title-caps").ok, false);
  assert.equal(finding(f, "title-specific").ok, false);
  const titleSuggestion = finding(f, "title-celebrity").suggestions[0];
  assert.equal(titleSuggestion.field, "seoTitle");
  assert.match(titleSuggestion.text, /Rukmini Vasanth/);
  assert.equal(finding(f, "description-own").suggestions[0].field, "seoDescription");
  assert.equal(finding(f, "slug-format").ok, false);
  assert.equal(finding(f, "slug-no-date").ok, false);
  assert.equal(finding(f, "slug-format").suggestions[0].text, "rukmini-vasanth-black-dress-club-l-london");
  assert.equal(input.seoTitle, "OUTFIT LOOK OUTFIT LOOK OUTFIT", "the input is untouched");
});

test("review: a live look's slug is never re-suggested, and moving it is explained", () => {
  const saved = { slug: "rukmini-old-slug", live: true, slugLockedAt: "2026-09-01", publishedAt: "2026-09-01" };
  const f = auditFindings(look({ slug: "Rukmini_New" }), context({ saved }));
  assert.equal(finding(f, "slug-format").suggestions, undefined);
  assert.equal(finding(f, "slug-moved").ok, false);
  assert.match(finding(f, "slug-moved").explanation, /301/);
});

test("review: FAQs are optional, and weak ones are flagged", () => {
  assert.equal(finding(auditFindings(look(), context()), "faqs-useful").ok, true);
  const f = finding(auditFindings(look({ faqs: [{ question: "Where to buy", answer: "Club L." }] }), context()), "faqs-useful");
  assert.equal(f.ok, false);
  assert.match(f.explanation, /under 15 words/);
});

test("review: alt text that repeats or is just the keyword is flagged, with per-photo suggestions", () => {
  const f = auditFindings(look({ images: [{ url: "1", alt: "rukmini vasanth black dress" }, { url: "2", alt: "rukmini vasanth black dress" }] }), context());
  const alt = finding(f, "images-alt-distinct");
  assert.equal(alt.ok, false);
  assert.equal(alt.suggestions.length, 2);
  assert.notEqual(alt.suggestions[0].text, alt.suggestions[1].text);
  assert.equal(alt.suggestions[0].field, undefined, "alt suggestions are copy-only");
});

test("review: internal links to hubs that would be noindex are flagged", () => {
  const f = auditFindings(look(), context({ celebrities: [], occasions: [{ name: "Party", slug: "", looks: 0, introWords: 0, record: true }] }));
  assert.equal(finding(f, "links-celebrity-hub").ok, false, "a first look with no bio leaves her page noindex");
  assert.equal(finding(f, "links-occasion-hub").ok, false);
  const ok = auditFindings(look(), context({ celebrities: [{ name: "Rukmini Vasanth", slug: "", looks: 0, introWords: 120, record: true }] }));
  assert.equal(finding(ok, "links-celebrity-hub").ok, true, "a 100-word bio makes it indexable");
});

test("review: a duplicate title is high priority", () => {
  const other = { id: 5, slug: "x", title: "Rukmini Vasanth's Black Dress by Club L London", celebrity: "Rukmini Vasanth", published: true, keywords: [], notes: "" };
  const f = finding(auditFindings(look(), context({ others: [other] })), "title-unique");
  assert.equal(f.ok, false);
  assert.equal(f.severity, "high");
});

// ------------------------------------------------------------------ legacy outfits

test("legacy: a live look saved before keywords, slugs and publish dates existed is reviewed without errors", () => {
  const legacy = {
    id: 3,
    celebrity: "Kayadu Lohar",
    event: "Instagram",
    occasion: "Festive",
    date: "2026-09-07",
    worn: 0,
    swap: 0,
    items: [{ id: "i1", name: "Navy saree", category: "saree", wornBrand: "Ritu Kumar", worn: 24000 }],
    notes: ["A navy saree."],
  };
  const site = buildSiteContext({ outfits: [legacy], celebrities: [{ name: "Kayadu Lohar", stats: { looks: 1 } }], occasions: [], self: legacy });
  assert.equal(site.others.length, 0);
  assert.equal(site.saved.live, true);
  assert.equal(site.saved.publishedAt, undefined);
  const input = { ...legacy, slug: site.saved.slug, secondaryKeywords: [], status: "published", images: [], leadChosen: false, faqs: [], links: [] };
  const review = buildReview(input, { ...context(site), owners: [] });
  assert.ok(review.blockers.some((f) => f.id === "checklist:keyword"), "the existing checklist still asks for a keyword");
  assert.equal(review.primary, null);
  const dates = review.recommendations.find((f) => f.id === "schema-dates");
  assert.match(dates.explanation, /before publication dates were recorded/);
});

test("site context: other looks carry keywords and text; the look itself is excluded", () => {
  const a = { id: 1, celebrity: "A", event: "E", occasion: "Party", date: "2026-01-01", worn: 0, swap: 0, items: [{ id: "x", name: "Dress", worn: 10 }], primaryKeyword: "a dress", secondaryKeywords: ["a red dress"], notes: ["One.", "Two."] };
  const b = { ...a, id: 2, status: "draft", primaryKeyword: undefined, secondaryKeywords: undefined };
  const site = buildSiteContext({ outfits: [a, b], celebrities: [{ name: "A", stats: { looks: 1 }, bio: ["one two three"] }], occasions: [], self: b });
  assert.deepEqual(site.others.map((o) => [o.id, o.keywords, o.notes, o.published]), [[1, ["a dress", "a red dress"], "One.\nTwo.", true]]);
  assert.equal(site.celebrities[0].introWords, 3);
  assert.equal(site.saved.live, false);
});

// ------------------------------------------------------------------ stored research

test("store: keys name a saved look or a prepared slug; anything else is refused", () => {
  assert.deepEqual(parseKey("outfit:12"), { kind: "outfit", outfitId: 12 });
  assert.deepEqual(parseKey("prepared:rukmini-black-dress"), { kind: "prepared", slug: "rukmini-black-dress" });
  for (const bad of ["outfit:", "outfit:-1", "prepared:Bad Slug", "prepared:../x", "x:1", 42, null]) assert.equal(parseKey(bad), null, String(bad));
  assert.equal(reviewKey(12, "s"), "outfit:12");
  assert.equal(reviewKey(undefined, "s"), "prepared:s");
  assert.equal(reviewKey(undefined, ""), null);
});

const payload = (over = {}) => ({
  key: "outfit:1",
  revision: 0,
  candidates: [
    { keyword: "  Rukmini Vasanth   Black Dress ", role: "primary", evidence: [kp()] },
    { keyword: "club l london dress", role: "secondary", evidence: [] },
  ],
  serp: [],
  ...over,
});

test("store: payloads are cleaned and validated; every problem is reported", () => {
  const ok = parseReviewPayload(payload(), TODAY);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.candidates[0].keyword, "rukmini vasanth black dress");
  const bad = parseReviewPayload(
    payload({
      key: "prepared:",
      candidates: [
        { keyword: "a", role: "primary", evidence: [kp({ value: "lots" })] },
        { keyword: "b", role: "primary", evidence: [] },
        { keyword: "A", role: "related", evidence: [] },
      ],
    }),
    TODAY,
  );
  assert.equal(bad.ok, false);
  const text = bad.errors.join(" | ");
  assert.match(text, /no slug yet/);
  assert.match(text, /range as shown/);
  assert.match(text, /Only one candidate can be the primary/);
  assert.match(text, /listed twice/);
  const cleaned = parseReviewPayload(payload({ candidates: [{ keyword: "x\u0000<b>y</b>", role: "weird", note: "n\u0007ote", evidence: [] }] }), TODAY);
  assert.equal(cleaned.value.candidates[0].keyword, "x <b>y</b>", "control characters removed; text is stored as text (React escapes it)");
  assert.equal(cleaned.value.candidates[0].role, "related");
  assert.equal(cleaned.value.candidates[0].note, "n ote");
  assert.equal(parseReviewPayload(payload({ candidates: Array.from({ length: 21 }, (_, i) => ({ keyword: `k${i}`, evidence: [] })) }), TODAY).ok, false);
});

test("store: manual result-page reviews are validated and summarised as observations, not predictions", () => {
  const review = { keyword: "rukmini vasanth black dress", checkedAt: TODAY, market: "IN", device: "mobile", features: ["shopping", "people-also-ask"], results: [
    { position: 1, domain: "https://www.instagram.com/p/x", type: "social", match: "exact" },
    { position: 2, domain: "clubl.example", type: "retailer", match: "exact" },
    { position: 3, domain: "news.example", type: "news", match: "different" },
    { position: 4, domain: "outfitid.example", type: "outfit-id-site", match: "similar" },
  ] };
  const parsed = parseReviewPayload(payload({ serp: [review] }), TODAY);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.serp[0].results[0].domain, "www.instagram.com", "URLs are reduced to their domain");
  const lines = serpObservations(parsed.value.serp[0]).join(" ");
  assert.match(lines, /2 of 4 recorded results are about this exact look/);
  assert.match(lines, /outfit-identification page/);
  assert.match(lines, /People also ask/);
  assert.doesNotMatch(lines, /rank|chance|probab|traffic/i);
  assert.equal(parseReviewPayload(payload({ serp: [{ ...review, checkedAt: "2026-12-01" }] }), TODAY).ok, false, "a future search date is refused");
  assert.equal(parseReviewPayload(payload({ serp: [{ ...review, results: [{ position: 1, domain: "not a domain", type: "news", match: "exact" }] }] }), TODAY).ok, false);
});

/** An in-memory repository with the same revision rules as the MongoDB one. */
function memoryRepo() {
  const docs = new Map();
  const calls = { get: 0, put: 0, remove: 0 };
  return {
    docs,
    calls,
    async get(key) {
      calls.get++;
      return docs.has(key) ? structuredClone(docs.get(key)) : null;
    },
    async put(doc, expected) {
      calls.put++;
      if ((docs.get(doc.key)?.revision ?? 0) !== expected) return "conflict";
      docs.set(doc.key, structuredClone(doc));
      return "ok";
    },
    async remove(key, expected) {
      calls.remove++;
      if (docs.get(key)?.revision !== expected) return "conflict";
      docs.delete(key);
      return "ok";
    },
  };
}
/** Saved looks as the server sees them: whether an id exists, and who owns a slug. */
const looks = (exists = true, owners = {}) => ({
  outfitExists: async () => exists,
  slugOwner: async (slug) => owners[slug] ?? null,
});
const ADMIN = { email: "editor@example.test" };
const NOW = new Date("2026-11-13T09:00:00Z");

test("authorization: without an admin session nothing is read or written", async () => {
  const repo = memoryRepo();
  const saved = await saveReview({ session: null, payload: payload(), repo, now: NOW, looks: looks(true) });
  assert.equal(saved.ok, false);
  assert.equal(saved.sessionExpired, true);
  const loaded = await loadReview({ session: null, key: "outfit:1", repo });
  assert.equal(loaded.ok, false);
  assert.deepEqual(repo.calls, { get: 0, put: 0, remove: 0 });
  const attached = await attachPrepared({ session: null, outfitId: 1, slug: "a-b", revision: 1, repo, now: NOW, savedSlugOf: async () => "a-b" });
  assert.equal(attached.sessionExpired, true);
  assert.deepEqual(repo.calls, { get: 0, put: 0, remove: 0 }, "attach touches nothing signed out either");
});

test("persistence: saves bump the revision, keep who and when, and refuse stale copies", async () => {
  const repo = memoryRepo();
  const first = await saveReview({ session: ADMIN, payload: payload(), repo, now: NOW, looks: looks(true) });
  assert.equal(first.ok, true);
  assert.equal(first.review.revision, 1);
  assert.equal(first.review.outfitId, 1);
  assert.equal(first.review.updatedBy, ADMIN.email);
  const stale = await saveReview({ session: ADMIN, payload: payload({ revision: 0 }), repo, now: NOW, looks: looks(true) });
  assert.equal(stale.ok, false);
  assert.equal(stale.conflict, true);
  const later = new Date("2026-11-14T09:00:00Z");
  const second = await saveReview({ session: ADMIN, payload: payload({ revision: 1, serp: [] }), repo, now: later, looks: looks(true) });
  assert.equal(second.review.revision, 2);
  assert.equal(second.review.createdAt, NOW.toISOString(), "created date is kept");
  assert.equal(second.review.updatedAt, later.toISOString());
  const loaded = await loadReview({ session: ADMIN, key: "outfit:1", repo });
  assert.equal(loaded.review.candidates[0].evidence[0].value, "100–1K");
});

test("persistence: research for a prepared (unsaved) look is stored under its slug; a missing look is refused", async () => {
  const repo = memoryRepo();
  const prepared = await saveReview({ session: ADMIN, payload: payload({ key: "prepared:rukmini-black-dress" }), repo, now: NOW, looks: looks(false) });
  assert.equal(prepared.ok, true);
  assert.equal(prepared.review.slug, "rukmini-black-dress");
  assert.equal(prepared.review.outfitId, undefined);
  const missing = await saveReview({ session: ADMIN, payload: payload({ key: "outfit:99" }), repo, now: NOW, looks: looks(false) });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /no longer exists/);
  const invalid = await saveReview({ session: ADMIN, payload: payload({ candidates: [{ keyword: "x", evidence: [kp({ market: "" })] }] }), repo, now: NOW, looks: looks(true) });
  assert.equal(invalid.ok, false);
  assert.equal(repo.docs.has("outfit:1"), false, "invalid research writes nothing");
});

// ------------------------------------------------------------------ identity: prepared slugs

test("identity: research cannot be saved under a slug a saved look already owns", async () => {
  const repo = memoryRepo();
  const taken = await saveReview({ session: ADMIN, payload: payload({ key: "prepared:rukmini-black-dress" }), repo, now: NOW, looks: looks(false, { "rukmini-black-dress": 7 }) });
  assert.equal(taken.ok, false);
  assert.match(taken.error, /Look #7 already uses the slug/);
  assert.equal(repo.calls.put, 0, "nothing written");
});

test("identity: a first save never overwrites research another draft saved under the same slug", async () => {
  const repo = memoryRepo();
  const draftA = await saveReview({ session: ADMIN, payload: payload({ key: "prepared:black-dress" }), repo, now: NOW, looks: looks(false) });
  assert.equal(draftA.ok, true);
  // Draft B had research loaded for another slug, then took this one:
  // the client sends revision 0 for a key it never loaded.
  const draftB = await saveReview({
    session: ADMIN,
    payload: payload({ key: "prepared:black-dress", candidates: [{ keyword: "something else", role: "primary", evidence: [] }] }),
    repo,
    now: NOW,
    looks: looks(false),
  });
  assert.equal(draftB.ok, false);
  assert.equal(draftB.conflict, true);
  assert.match(draftB.error, /already saved under the slug “black-dress”.*Nothing was overwritten/);
  assert.equal(repo.docs.get("prepared:black-dress").candidates[0].keyword, "rukmini vasanth black dress", "draft A's research is intact");
  // A revision number from another key that happens to match is still checked against this key.
  const sameNumber = await saveReview({ session: ADMIN, payload: payload({ key: "prepared:other-slug", revision: 1 }), repo, now: NOW, looks: looks(false) });
  assert.equal(sameNumber.conflict, true, "revision 1 means nothing for a key with no research");
  assert.equal(repo.docs.has("prepared:other-slug"), false);
});

test("identity: prepared research attaches only on request, only to the look whose saved slug matches, and moves rather than copies", async () => {
  const repo = memoryRepo();
  await saveReview({ session: ADMIN, payload: payload({ key: "prepared:black-dress" }), repo, now: NOW, looks: looks(false) });
  const savedSlugOf = async (id) => ({ 1: "black-dress", 2: "red-saree" })[id] ?? null;
  const attach = (over = {}) => attachPrepared({ session: ADMIN, outfitId: 1, slug: "black-dress", revision: 1, repo, now: NOW, savedSlugOf, ...over });

  const wrongLook = await attach({ outfitId: 2 });
  assert.equal(wrongLook.ok, false);
  assert.match(wrongLook.error, /saved slug is “red-saree”/);
  assert.equal((await attach({ outfitId: 99 })).ok, false, "a missing look gets nothing");
  assert.equal((await attach({ revision: 5 })).conflict, true, "a stale offer is refused");
  assert.equal((await attach({ slug: "../x" })).ok, false, "malformed input is refused");
  assert.equal(repo.docs.size, 1, "none of the refusals wrote anything");

  const ok = await attach();
  assert.equal(ok.ok, true);
  assert.equal(ok.review.key, "outfit:1");
  assert.equal(ok.review.revision, 1);
  assert.deepEqual(ok.review.attachedFrom, { key: "prepared:black-dress", revision: 1, at: NOW.toISOString(), by: ADMIN.email });
  assert.equal(repo.docs.has("prepared:black-dress"), false, "the prepared copy is removed, so no later look can take it");
  assert.equal(repo.docs.get("outfit:1").candidates[0].keyword, "rukmini vasanth black dress");
  assert.equal((await attach()).ok, false, "attaching twice does nothing");

  await saveReview({ session: ADMIN, payload: payload({ key: "prepared:red-saree-x" }), repo, now: NOW, looks: looks(false) });
  repo.docs.set("outfit:3", { ...repo.docs.get("outfit:1"), key: "outfit:3", outfitId: 3 });
  const hasOwn = await attachPrepared({ session: ADMIN, outfitId: 3, slug: "red-saree-x", revision: 1, repo, now: NOW, savedSlugOf: async () => "red-saree-x" });
  assert.equal(hasOwn.ok, false);
  assert.match(hasOwn.error, /already has its own research/);
  assert.equal(repo.docs.has("prepared:red-saree-x"), true, "a refused attach leaves the prepared research alone");
});

test("identity: a saved look's research is keyed by id, so changing its slug cannot move or mix research", () => {
  assert.equal(reviewKey(4, "old-slug"), "outfit:4");
  assert.equal(reviewKey(4, "new-slug"), "outfit:4");
  assert.equal(reviewKey(undefined, "new-slug"), "prepared:new-slug");
  assert.equal(reviewKey(undefined, ""), null, "no slug, no key: nothing can be saved");
  assert.equal(parseKey("prepared:Black Dress"), null);
  assert.equal(parseKey("outfit:1;drop"), null);
  assert.equal(parseKey({ $ne: null }), null, "operator objects are not keys");
});

// ------------------------------------------------------------------ honesty of suggestions

test("suggestions use only the look's own facts: no invented brands, shops, prices or repeated keywords", () => {
  const plain = look({
    seoTitle: undefined,
    seoDescription: undefined,
    items: [{ id: "p1", name: "Black midi dress", category: "dress", colours: ["black"] }],
    links: [],
  });
  const suggestions = auditFindings(plain, context()).flatMap((f) => f.suggestions ?? []);
  const all = suggestions.map((s) => s.text).join("\n");
  assert.ok(all.length > 0, "there are suggestions to check");
  for (const invented of ["Club L", "Steve Madden", "Myntra", "Amazon", "Ajio", "Zara", "Sabyasachi", "Nykaa", "H&M"]) {
    assert.ok(!all.includes(invented), `no suggestion names ${invented}`);
  }
  assert.doesNotMatch(all, /₹|\$\d|rs\.?\s?\d/i, "no prices without a recorded price");
  for (const s of suggestions.filter((s) => s.field === "seoTitle" || s.field === "seoDescription")) {
    assert.ok(phraseCount(s.text, "rukmini vasanth black dress") <= 1, `keyword not repeated in: ${s.text}`);
  }
});
