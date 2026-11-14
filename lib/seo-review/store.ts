/**
 * The saved keyword research for one look: candidate keywords with their
 * demand evidence, and manual reviews of what Google shows for them.
 *
 * Stored in its own collection, `seoReviews`, one document per look, so the
 * outfit documents, their save action and their publishing rules are not
 * touched. A look that is not in the database yet (a prepared look being
 * checked in the New outfit form) keeps its research under its intended slug
 * until it is saved.
 *
 *   key        "outfit:<id>" or "prepared:<slug>"
 *   revision   bumped on every save; a save from a stale copy is refused
 *
 * Pure apart from the repository passed in, so validation, authorisation and
 * conflicts are all tested without a database.
 */

import { EVIDENCE_SOURCES, evidenceProblems, type Evidence } from "@/lib/seo-review/evidence";
import { arr, date, obj, optional, str, url, validate } from "@/lib/seo-review/schema";

export const CANDIDATE_ROLES = ["primary", "secondary", "related", "rejected"] as const;
export type CandidateRole = (typeof CANDIDATE_ROLES)[number];

export type Candidate = { keyword: string; role: CandidateRole; note?: string; evidence: Evidence[] };

export const SERP_RESULT_TYPES = ["outfit-id-site", "news", "retailer", "social", "video", "brand", "forum", "other"] as const;
export const SERP_RESULT_LABEL: Record<(typeof SERP_RESULT_TYPES)[number], string> = {
  "outfit-id-site": "Outfit-ID / fashion site",
  news: "News / entertainment",
  retailer: "Retailer or marketplace",
  social: "Instagram / Pinterest / social",
  video: "Video",
  brand: "The brand's own site",
  forum: "Forum / Q&A",
  other: "Other",
};
export const SERP_MATCH = ["exact", "similar", "different"] as const;
export const SERP_FEATURES = ["images", "videos", "shopping", "people-also-ask", "top-stories", "instagram"] as const;

export type SerpResult = { position: number; domain: string; type: (typeof SERP_RESULT_TYPES)[number]; match: (typeof SERP_MATCH)[number] };
export type SerpReview = {
  keyword: string;
  checkedAt: string;
  market: string;
  device: "mobile" | "desktop";
  results: SerpResult[];
  features: (typeof SERP_FEATURES)[number][];
  note?: string;
};

export type SeoReviewDoc = {
  key: string;
  outfitId?: number;
  slug?: string;
  revision: number;
  candidates: Candidate[];
  serp: SerpReview[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  /** What the editor accepted and rejected from each imported AI research comparison (newest last). */
  aiReviews?: AiReview[];
  /** Set when an editor attached research prepared under a slug to this look. */
  attachedFrom?: { key: string; revision: number; at: string; by: string };
};

export const LIMITS = { candidates: 20, evidence: 10, serp: 3, results: 10, note: 500, keyword: 80, aiReviews: 5, aiItems: 30, aiText: 500, aiSources: 3, aiRejected: 200 };
// The AI limits keep a full research save under the 1 MB a Next.js server action accepts by default.

/**
 * One import of a Claude + Codex comparison (lib/seo-review/reconcile.ts):
 * the items the editor accepted, with their text and sources kept so the
 * decision can be re-read later, and the ids they rejected. A record of a
 * human decision — it changes nothing on the look.
 */
export type AiReviewItem = {
  id: string;
  kind: "fact" | "keyword" | "recommendation";
  text: string;
  decision?: string;
  field?: string;
  copy?: string;
  sources: string[];
};
export type AiReview = { importedAt: string; fingerprint: string; comparedFrom: string; accepted: AiReviewItem[]; rejected: string[] };

const aiReviewSchema = obj({
  importedAt: date(),
  fingerprint: str(64, { re: /^[0-9a-f]{64}$/ }),
  comparedFrom: date(),
  accepted: arr(
    obj({
      id: str(90, { min: 1 }),
      kind: str(20, { enum: ["fact", "keyword", "recommendation"] }),
      text: str(LIMITS.aiText, { min: 1 }),
      decision: optional(str(30)),
      field: optional(str(20, { enum: ["seoTitle", "seoDescription", "primaryKeyword", "faq", "notes", "imageAlt"] })),
      copy: optional(str(1200)),
      sources: arr(url(), LIMITS.aiSources),
    }),
    LIMITS.aiItems,
  ),
  rejected: arr(str(90), LIMITS.aiRejected),
});

const KEY = /^(outfit:(\d{1,9})|prepared:([a-z0-9]+(?:-[a-z0-9]+)*))$/;

export function parseKey(key: unknown): { kind: "outfit"; outfitId: number } | { kind: "prepared"; slug: string } | null {
  const m = typeof key === "string" && key.length <= 100 ? KEY.exec(key) : null;
  if (!m) return null;
  return m[2] ? { kind: "outfit", outfitId: Number(m[2]) } : { kind: "prepared", slug: m[3] };
}

export const reviewKey = (outfitId: number | undefined, slug: string) =>
  outfitId !== undefined ? `outfit:${outfitId}` : slug ? `prepared:${slug}` : null;

// Control characters out, whitespace collapsed, length capped.
const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
const normaliseKeyword = (value: unknown) => clean(value, LIMITS.keyword).toLowerCase();
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === "string" && (list as readonly string[]).includes(value);

export type ReviewPayload = { key: string; revision: number; candidates: Candidate[]; serp: SerpReview[]; aiReviews: AiReview[] };

/** Untrusted input (from the browser) → a clean payload, or every problem in plain words. */
export function parseReviewPayload(raw: unknown, today: string): { ok: true; value: ReviewPayload } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const key = typeof input.key === "string" ? input.key : "";
  if (!parseKey(key)) errors.push("This look has no slug yet. Set a slug (or save the look) before saving research.");
  const revision = Number.isInteger(input.revision) && (input.revision as number) >= 0 ? (input.revision as number) : -1;
  if (revision < 0) errors.push("Missing revision.");

  const rawCandidates = Array.isArray(input.candidates) ? input.candidates : [];
  if (rawCandidates.length > LIMITS.candidates) errors.push(`At most ${LIMITS.candidates} candidate keywords.`);
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const entry of rawCandidates.slice(0, LIMITS.candidates)) {
    const c = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const keyword = normaliseKeyword(c.keyword);
    if (!keyword) {
      errors.push("A candidate keyword is empty.");
      continue;
    }
    if (seen.has(keyword)) {
      errors.push(`“${keyword}” is listed twice.`);
      continue;
    }
    seen.add(keyword);
    const role = oneOf(CANDIDATE_ROLES, c.role) ? c.role : "related";
    const rawEvidence = Array.isArray(c.evidence) ? c.evidence : [];
    if (rawEvidence.length > LIMITS.evidence) errors.push(`“${keyword}”: at most ${LIMITS.evidence} evidence items.`);
    const evidence: Evidence[] = [];
    for (const item of rawEvidence.slice(0, LIMITS.evidence)) {
      const e = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const parsed: Evidence = {
        id: typeof e.id === "string" && ID.test(e.id) ? e.id : "",
        source: oneOf(EVIDENCE_SOURCES, e.source) ? e.source : ("" as Evidence["source"]),
        value: clean(e.value, 40),
        period: clean(e.period, 60),
        market: clean(e.market, 6).toUpperCase(),
        collectedAt: clean(e.collectedAt, 10),
        ...(clean(e.url, 500) ? { url: clean(e.url, 500) } : {}),
        ...(clean(e.note, LIMITS.note) ? { note: clean(e.note, LIMITS.note) } : {}),
      };
      if (!parsed.id) errors.push(`“${keyword}”: an evidence item has no id.`);
      for (const problem of evidenceProblems(parsed, today)) errors.push(`“${keyword}”: ${problem}`);
      evidence.push(parsed);
    }
    candidates.push({ keyword, role, ...(clean(c.note, LIMITS.note) ? { note: clean(c.note, LIMITS.note) } : {}), evidence });
  }
  if (candidates.filter((c) => c.role === "primary").length > 1) errors.push("Only one candidate can be the primary keyword.");

  const rawSerp = Array.isArray(input.serp) ? input.serp : [];
  if (rawSerp.length > LIMITS.serp) errors.push(`At most ${LIMITS.serp} result-page reviews.`);
  const serp: SerpReview[] = [];
  for (const entry of rawSerp.slice(0, LIMITS.serp)) {
    const s = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const keyword = normaliseKeyword(s.keyword);
    const checkedAt = clean(s.checkedAt, 10);
    if (!keyword) errors.push("A result-page review has no keyword.");
    if (!DAY.test(checkedAt) || checkedAt > today) errors.push(`Result-page review “${keyword}”: enter the day you searched.`);
    const results: SerpResult[] = [];
    for (const r of (Array.isArray(s.results) ? s.results : []).slice(0, LIMITS.results)) {
      const row = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
      const domain = clean(row.domain, 80).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!domain) continue;
      const position = Number(row.position);
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) errors.push(`Result-page review “${keyword}”: “${domain}” is not a domain.`);
      if (!Number.isInteger(position) || position < 1 || position > 100) errors.push(`Result-page review “${keyword}”: position must be 1–100.`);
      results.push({ position, domain, type: oneOf(SERP_RESULT_TYPES, row.type) ? row.type : "other", match: oneOf(SERP_MATCH, row.match) ? row.match : "different" });
    }
    serp.push({
      keyword,
      checkedAt,
      market: clean(s.market, 6).toUpperCase() || "IN",
      device: s.device === "desktop" ? "desktop" : "mobile",
      results: results.sort((a, b) => a.position - b.position),
      features: (Array.isArray(s.features) ? s.features : []).filter((f): f is SerpReview["features"][number] => oneOf(SERP_FEATURES, f)),
      ...(clean(s.note, LIMITS.note) ? { note: clean(s.note, LIMITS.note) } : {}),
    });
  }

  const rawAi = input.aiReviews === undefined ? [] : input.aiReviews;
  const aiReviews: AiReview[] = [];
  if (!Array.isArray(rawAi)) errors.push("AI research records are malformed.");
  else {
    if (rawAi.length > LIMITS.aiReviews) errors.push(`At most ${LIMITS.aiReviews} AI research imports are kept; remove the oldest.`);
    rawAi.slice(0, LIMITS.aiReviews).forEach((entry, i) => {
      const problems = validate(entry, aiReviewSchema, `AI research import ${i + 1}`);
      if (problems.length) errors.push(...problems.slice(0, 5));
      else if ((entry as AiReview).importedAt > today) errors.push(`AI research import ${i + 1}: the import date is in the future.`);
      else aiReviews.push(entry as AiReview);
    });
  }

  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true, value: { key, revision, candidates, serp, aiReviews } };
}

/**
 * What a manual result-page review says, in plain observations. Counts only —
 * no prediction of whether this page could rank there.
 */
export function serpObservations(review: SerpReview): string[] {
  const n = review.results.length;
  if (!n) return ["No results recorded yet."];
  const count = (pred: (r: SerpResult) => boolean) => review.results.filter(pred).length;
  const exact = count((r) => r.match === "exact");
  const retail = count((r) => r.type === "retailer" || r.type === "brand");
  const outfit = count((r) => r.type === "outfit-id-site");
  const news = count((r) => r.type === "news");
  const social = count((r) => r.type === "social" || r.type === "video");
  const lines = [`${exact} of ${n} recorded results are about this exact look.`];
  if (outfit) lines.push(`${outfit} ${outfit === 1 ? "is an outfit-identification page" : "are outfit-identification pages"} — the same kind of page as ours; open them and check what they include that this look does not.`);
  if (retail >= Math.ceil(n / 2)) lines.push("Mostly shops: searchers seem to want to buy. Make sure prices and shop links are prominent.");
  if (news >= Math.ceil(n / 2)) lines.push("Mostly news: searchers seem to want the story, not the outfit. This keyword may not suit an outfit page.");
  if (social >= Math.ceil(n / 2)) lines.push("Mostly Instagram or video: the look itself is what people want to see. Strong photos and the event context matter.");
  if (exact === 0) lines.push("Nothing on the page is about this look yet. That can mean little competition — or little demand. The review cannot tell which.");
  if (review.features.includes("shopping")) lines.push("Google shows shopping results for this search.");
  if (review.features.includes("people-also-ask")) lines.push("Google shows “People also ask”: consider answering those questions in FAQs, if they fit this look.");
  return lines;
}

// ------------------------------------------------------------------ service

export type ReviewRepo = {
  get(key: string): Promise<SeoReviewDoc | null>;
  /** Writes `doc` only if the stored revision is still `expected` (0 = none stored). */
  put(doc: SeoReviewDoc, expected: number): Promise<"ok" | "conflict">;
  /** Deletes the document only if its stored revision is still `expected`. */
  remove(key: string, expected: number): Promise<"ok" | "conflict">;
};

type Session = { email: string } | null;
export type SaveResult =
  | { ok: true; review: SeoReviewDoc }
  | { ok: false; error: string; errors?: string[]; sessionExpired?: boolean; conflict?: boolean };

/** The calendar day in India for an instant, YYYY-MM-DD. */
export const istDay = (now: Date) => now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const EXPIRED = { ok: false as const, error: "Your session expired. Sign in again — your research is still on screen.", sessionExpired: true };

/**
 * What the save needs to know about the saved looks, from the database:
 * whether an id exists, and which look (if any) owns a slug. Slugs are unique
 * across looks — the outfit save refuses a duplicate.
 */
export type LookIndex = {
  outfitExists: (id: number) => Promise<boolean>;
  slugOwner: (slug: string) => Promise<number | null>;
};

/**
 * Admin only. Validates, checks the look exists, and refuses a save made from
 * a stale copy.
 *
 * Research under a prepared slug is refused once a saved look owns that slug:
 * it would otherwise sit where the look's edit page offers it, and a slug can
 * be reused by a different look than the one it was researched for. Research
 * for a saved look is keyed by its id, which never changes.
 */
export async function saveReview({
  session,
  payload,
  repo,
  now,
  looks,
}: {
  session: Session;
  payload: unknown;
  repo: ReviewRepo;
  now: Date;
  looks: LookIndex;
}): Promise<SaveResult> {
  if (!session) return EXPIRED;
  // The editor's "today" is India's (the panel dates evidence and imports in IST); in UTC it is
  // still yesterday until 05:30 IST, which would refuse anything dated today as "in the future".
  const today = istDay(now);
  const parsed = parseReviewPayload(payload, today);
  if (!parsed.ok) return { ok: false, error: "Nothing was saved. Fix these first:", errors: parsed.errors };
  const target = parseKey(parsed.value.key)!;
  if (target.kind === "outfit" && !(await looks.outfitExists(target.outfitId))) return { ok: false, error: "That look no longer exists." };
  if (target.kind === "prepared") {
    const owner = await looks.slugOwner(target.slug);
    if (owner !== null) {
      return { ok: false, error: `Look #${owner} already uses the slug “${target.slug}”. Nothing was saved. Choose another slug for this new look, or research that look from its own edit page.` };
    }
  }
  const existing = await repo.get(parsed.value.key);
  if (existing && parsed.value.revision === 0) {
    return {
      ok: false,
      error: target.kind === "prepared"
        ? `Research is already saved under the slug “${target.slug}”, possibly for another draft. Nothing was overwritten. Choose a different slug, or reload to open that research.`
        : "Research for this look was saved elsewhere since you opened it. Nothing was overwritten. Reload to see it.",
      conflict: true,
    };
  }
  if ((existing?.revision ?? 0) !== parsed.value.revision) {
    return { ok: false, error: "This research was changed elsewhere since you opened it. Reload to see the latest, then redo your change.", conflict: true };
  }
  const doc: SeoReviewDoc = {
    key: parsed.value.key,
    ...(target.kind === "outfit" ? { outfitId: target.outfitId } : { slug: target.slug }),
    revision: parsed.value.revision + 1,
    candidates: parsed.value.candidates,
    ...(parsed.value.aiReviews.length ? { aiReviews: parsed.value.aiReviews } : {}),
    serp: parsed.value.serp,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
    updatedBy: session.email,
  };
  const written = await repo.put(doc, parsed.value.revision);
  if (written === "conflict") return { ok: false, error: "Someone saved this research at the same moment. Reload and try again.", conflict: true };
  return { ok: true, review: doc };
}

export async function loadReview({ session, key, repo }: { session: Session; key: unknown; repo: ReviewRepo }) {
  if (!session) return { ok: false as const, error: "Your session expired.", sessionExpired: true };
  if (!parseKey(key)) return { ok: false as const, error: "No research key." };
  return { ok: true as const, review: await repo.get(key as string) };
}

/**
 * Moves research prepared under a slug onto a saved look — only when an editor
 * asks, never automatically. All of these must hold, checked here rather than
 * trusted from the browser:
 *   - the look exists and its saved slug is the prepared slug;
 *   - the look has no research of its own yet (nothing is overwritten);
 *   - the prepared research is still the revision the editor was shown.
 * The look's copy is written first (insert-only), then the prepared copy is
 * removed, so it cannot be offered to another look that later takes the slug.
 */
export async function attachPrepared({
  session,
  outfitId,
  slug,
  revision,
  repo,
  now,
  savedSlugOf,
}: {
  session: Session;
  outfitId: unknown;
  slug: unknown;
  revision: unknown;
  repo: ReviewRepo;
  now: Date;
  savedSlugOf: (id: number) => Promise<string | null>;
}): Promise<SaveResult> {
  if (!session) return EXPIRED;
  const target = parseKey(`outfit:${outfitId}`);
  const source = parseKey(`prepared:${slug}`);
  if (target?.kind !== "outfit" || source?.kind !== "prepared" || !Number.isInteger(revision) || (revision as number) < 1) {
    return { ok: false, error: "Nothing was attached: the request was incomplete." };
  }
  const savedSlug = await savedSlugOf(target.outfitId);
  if (savedSlug === null) return { ok: false, error: "That look no longer exists." };
  if (savedSlug !== source.slug) {
    return { ok: false, error: `Nothing was attached: this look’s saved slug is “${savedSlug}”, not “${source.slug}”.` };
  }
  const targetKey = `outfit:${target.outfitId}`;
  const sourceKey = `prepared:${source.slug}`;
  if (await repo.get(targetKey)) return { ok: false, error: "This look already has its own research. Nothing was attached or overwritten.", conflict: true };
  const prepared = await repo.get(sourceKey);
  if (!prepared || prepared.revision !== revision) {
    return { ok: false, error: "The prepared research changed or was attached elsewhere. Reload to see what is there now.", conflict: true };
  }
  const doc: SeoReviewDoc = {
    key: targetKey,
    outfitId: target.outfitId,
    revision: 1,
    candidates: prepared.candidates,
    serp: prepared.serp,
    ...(prepared.aiReviews?.length ? { aiReviews: prepared.aiReviews } : {}),
    createdAt: prepared.createdAt,
    updatedAt: now.toISOString(),
    updatedBy: session.email,
    attachedFrom: { key: sourceKey, revision: prepared.revision, at: now.toISOString(), by: session.email },
  };
  if ((await repo.put(doc, 0)) === "conflict") return { ok: false, error: "This look got research of its own at the same moment. Nothing was attached. Reload.", conflict: true };
  // If the prepared copy changed in between, it stays; it is never offered to
  // this look again, because the look now has research of its own.
  await repo.remove(sourceKey, prepared.revision);
  return { ok: true, review: doc };
}
