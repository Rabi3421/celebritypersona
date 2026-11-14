// Synthetic fixtures for the dual-AI research tests: a look as the outfit form
// reads it, and findings files as Claude Code and Codex would write them.
// Every name, brand, URL and price here is invented for testing.

export const TODAY = "2026-11-14";

/** Strings planted in fields that must never reach a research pack. */
export const CANARY = {
  affiliate: "CANARY-AFFILIATE-7f3a",
  network: "CANARY-NETWORK-91c2",
  imageUrl: "CANARY-IMAGE-URL-55aa",
  pieceId: "CANARY-PIECE-ID-0d0d",
  draftTitle: "CANARY-OTHER-DRAFT-TITLE",
  draftKeyword: "canary other draft keyword",
  draftNotes: "CANARY-OTHER-DRAFT-NOTES",
  publishedNotes: "CANARY-PUBLISHED-NOTES",
  evidenceId: "CANARYEVIDENCEID",
  stray: "CANARY-STRAY-FIELD",
  tracking: "CANARYTRACK",
  draftOnlyCelebrity: "Canary Draftonly Celebrity",
  emptyOccasion: "Canary Unused Occasion",
};

export function snapshot(over = {}) {
  return {
    celebrity: "Tara Synthetic",
    event: "Test Gala 2026",
    occasion: "Party",
    occasions: ["Party"],
    slug: "tara-synthetic-emerald-gown",
    seoTitle: "Tara Synthetic's Emerald Gown at the Test Gala",
    seoDescription: "Tara Synthetic wore an emerald satin gown by Example Atelier to the Test Gala 2026. Shop the original and a lookalike.",
    primaryKeyword: "tara synthetic emerald gown",
    secondaryKeywords: ["example atelier gown"],
    status: "draft",
    notes: ["Tara Synthetic chose an emerald satin gown by Example Atelier for the Test Gala.", "The cut is a bias slip with a cowl neck."],
    photoCredit: "Instagram / @tarasynthetic",
    images: [
      { url: `https://firebasestorage.example/${CANARY.imageUrl}.webp`, alt: "Tara Synthetic in an emerald satin gown at the Test Gala" },
      { url: `https://firebasestorage.example/${CANARY.imageUrl}-2.webp`, alt: "Detail of the cowl neck" },
    ],
    items: [
      { id: CANARY.pieceId, name: "Emerald satin gown", category: "gown", colours: ["green"], wornBrand: "Example Atelier", worn: 48000, swapBrand: "High Street Co", swap: 3200 },
      { id: "row-1", name: "Gold drop earrings", category: "earrings", colours: ["gold"] },
    ],
    leadPieceId: CANARY.pieceId,
    leadChosen: true,
    date: "2026-11-01",
    faqs: [{ question: "Who made Tara Synthetic's gown?", answer: "Example Atelier." }],
    links: [
      {
        piece: "Emerald satin gown",
        side: "original",
        url: `https://www.exampleatelier.test/products/emerald-gown?variant=42&utm_source=${CANARY.tracking}&tag=${CANARY.tracking}-21#reviews`,
        status: "ok",
        affiliateUrl: `https://linksredirect.com/?${CANARY.affiliate}`,
        network: CANARY.network,
      },
      { piece: "Emerald satin gown", side: "swap", url: `https://amzn.to/${CANARY.tracking}`, status: "unverified" },
    ],
    [CANARY.stray]: "should never be read",
    subscriberEmail: "reader@example.test",
    ...over,
  };
}

export const research = {
  candidates: [
    {
      keyword: "tara synthetic emerald gown",
      role: "primary",
      evidence: [{ id: CANARY.evidenceId, source: "search-console", value: "12", period: "last 28 days", market: "IN", collectedAt: "2026-11-10" }],
    },
  ],
  serp: [],
};

export const review = {
  readiness: { percent: 80, passed: 40, total: 50, blockers: 1, disclaimer: "" },
  blockers: [{ id: "links-swap", kind: "blocker", severity: "high", ok: false, area: "products", title: "The swap link is unverified", explanation: "", fix: "Verify it." }],
  recommendations: [{ id: "content-names-pieces", kind: "editorial", severity: "medium", ok: false, area: "content", title: "Name every piece", explanation: "", fix: "Name the earrings." }],
};

export const others = [
  { id: 2, slug: "other-draft", title: CANARY.draftTitle, celebrity: "Someone", published: false, keywords: [CANARY.draftKeyword], notes: CANARY.draftNotes },
  { id: 3, slug: "nina-example-red-saree", title: "Nina Example's Red Saree", celebrity: "Nina Example", published: true, keywords: ["nina example red saree"], notes: CANARY.publishedNotes },
];
export const hubs = {
  // This look's own celebrity has no published look yet; a draft-only celebrity record must not leave.
  celebrities: [
    { name: "Tara Synthetic", slug: "", looks: 0, introWords: 0, record: true },
    { name: "Nina Example", slug: "", looks: 1, introWords: 0, record: true },
    { name: CANARY.draftOnlyCelebrity, slug: "", looks: 0, introWords: 0, record: true },
  ],
  occasions: [
    { name: "Party", slug: "", looks: 4, introWords: 0, record: true },
    { name: CANARY.emptyOccasion, slug: "", looks: 0, introWords: 0, record: true },
  ],
};

export const packInput = (over = {}) => ({
  key: "outfit:7",
  basis: "saved",
  generatedAt: "2026-11-14T10:00:00Z",
  look: snapshot(),
  research,
  review,
  others,
  celebrities: hubs.celebrities,
  occasions: hubs.occasions,
  ...over,
});

const src = (url, quote) => ({ url, accessedAt: "2026-11-13", ...(quote ? { quote } : {}) });
export const RETAILER = "https://www.exampleatelier.test/products/emerald-gown?variant=42";
export const NEWS = "https://news.example.test/test-gala-2026-looks";
export const INSTA = "https://www.instagram.com/tarasynthetic/p/ABC123/";

/** A findings file for this pack. `answers` maps check ids to [status, sources, correctedValue?]. */
export function findings(pack, { tool, pass, answers = {}, keywords, recommendations, challenges = [], gaps = [], additionalFacts = [] }) {
  const base = { schema: "cp-seo-findings/1", tool, pass, pack: { key: pack.key, fingerprint: pack.fingerprint }, completedAt: "2026-11-13" };
  if (pass === "challenge") return { ...base, checks: [], additionalFacts: [], keywords: [], competition: [], recommendations: [], challenges, gaps };
  return {
    ...base,
    searchIntent: { primary: "identify-outfit", explanation: `${tool} found searchers asking who made the gown.`, sources: [src(NEWS)] },
    checks: pack.checks.map((c) => {
      const [status, sources, correctedValue] = answers[c.id] ?? ["unverifiable", []];
      return { id: c.id, status, finding: `${tool} on ${c.id}: ${status}.`, ...(correctedValue ? { correctedValue } : {}), sources };
    }),
    additionalFacts,
    keywords: keywords ?? [
      { keyword: "tara synthetic emerald gown", role: "primary", intent: "identify-outfit", rationale: `${tool}: names the celebrity, colour and garment.`, demand: { status: "unknown" }, risks: [] },
      { keyword: "example atelier emerald gown", role: "secondary", intent: "buy", rationale: `${tool}: brand plus product.`, demand: { status: "unknown" }, risks: [] },
    ],
    competition: [{ keyword: "tara synthetic emerald gown", method: "tool-web-search", observations: ["News galleries of the gala; no outfit-identification page."], sources: [src(NEWS)] }],
    recommendations: recommendations ?? [
      { id: "R1", area: "content", severity: "medium", issue: "The earrings are not identified.", fix: "Say the earrings are unidentified, or identify them.", sources: [] },
      { id: "R2", area: "title", severity: "low", issue: "Title could lead with the keyword.", fix: "Use the keyword first.", copy: { field: "seoTitle", text: "Tara Synthetic Emerald Gown at the Test Gala" }, sources: [] },
    ],
    challenges: [],
    gaps,
  };
}

export { src };
