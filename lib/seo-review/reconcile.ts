/**
 * Claude's and Codex's findings for one pack, compared deterministically.
 *
 * The same inputs always give the same output: no clock, no randomness, no
 * network, no third model. Two rules hold throughout:
 *
 *   - Agreement between the tools is not verification. A fact counts as
 *     verified only when both tools reach the same answer AND at least one of
 *     them cites a primary source (grade A or B, below).
 *   - Anything disputed, single-tool or unsupported is left unticked. The
 *     editor can still tick it — that is their decision, not this file's.
 *
 * Grades, per fact:
 *   A  both tools cite the same primary source
 *   B  at least one primary source
 *   C  sources, but only secondary ones
 *   D  no sources
 * A primary source is the retailer page the look already links for that piece,
 * the brand's own site (its name is in the address), or the Instagram account
 * the photo credit names. Everything else is secondary. The rule is printed in
 * comparison.md so it can be checked by hand.
 */

import { phraseCount } from "@/lib/seo-review/audit";
import { relevance, type LookFacts } from "@/lib/seo-review/keyword";
import type { Findings, Source, Status } from "@/lib/seo-review/findings";
import { AREAS, COPY_FIELDS, GAP_AREAS, INTENTS, ROLES, STATUSES, VERDICTS } from "@/lib/seo-review/findings";
import type { PackCheck, ResearchPack } from "@/lib/seo-review/pack";
import { arr, bool, date, lit, obj, optional, str, url, validate, type Schema } from "@/lib/seo-review/schema";

export const RECONCILED_SCHEMA = "cp-seo-reconciled/1";

type By = "claude" | "codex";
export type Grade = "A" | "B" | "C" | "D";
export type GradedSource = Source & { by: By; kind: "primary" | "secondary"; why: string };
export type FactDecision = "verified" | "verified-contradiction" | "unverified" | "disputed" | "single-tool";
export type KeywordDecision = "recommended-primary" | "agreed-supporting" | "disputed" | "single-tool" | "rejected";
type Answer = { status: Status; finding: string; correctedValue?: string };
type Verdict = { verdict: (typeof VERDICTS)[number]; reason: string };

export type ReconciledFact = {
  id: string;
  about: string;
  field: string;
  statement: string;
  claude?: Answer;
  codex?: Answer;
  challenge?: Verdict;
  sources: GradedSource[];
  grade: Grade;
  decision: FactDecision;
  preselected: boolean;
};
export type ReconciledKeyword = {
  id: string;
  keyword: string;
  claude?: { role: string; intent: string; rationale: string };
  codex?: { role: string; intent: string; rationale: string };
  challenge?: Verdict;
  mismatches: string[];
  overlaps: string[];
  demand: { by: By; status: "observed"; sourceName: string; url: string; value: string; period: string; market: string; collectedAt: string; note?: string }[];
  decision: KeywordDecision;
  suggestedRole: "primary" | "secondary" | "related";
  preselected: boolean;
};
export type ReconciledRecommendation = {
  id: string;
  by: By;
  area: string;
  severity: "high" | "medium" | "low";
  issue: string;
  fix: string;
  copy?: { field: string; text: string };
  sources: GradedSource[];
  bothRaisedArea: boolean;
  challenge?: Verdict;
  flags: string[];
  preselected: boolean;
};
export type Reconciled = {
  schema: typeof RECONCILED_SCHEMA;
  pack: { key: string; fingerprint: string; slug: string; celebrity: string };
  comparedFrom: string;
  inputs: { tool: string; pass: string; completedAt: string; sha256: string }[];
  summary: {
    primaryKeyword: { keyword: string | null; status: string; alternatives: string[] };
    supporting: string[];
    demand: { keyword: string; status: string }[];
    intent: { claude: string; codex: string; agreed: boolean; explanation: string };
    uncertainties: string[];
    improvements: string[];
    suggestedTitle?: { text: string; from: string; flags: string[] };
    suggestedDescription?: { text: string; from: string; flags: string[] };
    readyForReview: { ready: boolean; reasons: string[] };
    /** Signs the two passes were not independent, e.g. long passages copied from one to the other. */
    warnings: string[];
  };
  facts: ReconciledFact[];
  keywords: ReconciledKeyword[];
  recommendations: ReconciledRecommendation[];
  gaps: { by: By; area: string; note: string }[];
};

// ------------------------------------------------------------------ sources

const hostOf = (raw: string) => {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};
const sameSource = (raw: string) => {
  try {
    const u = new URL(raw);
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return raw;
  }
};
const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

export function classifySource(raw: string, about: string, field: string, pack: ResearchPack): { kind: "primary" | "secondary"; why: string } {
  const host = hostOf(raw);
  const piece = pack.pieces.find((p) => p.ref === about);
  if (piece) {
    const side = field.startsWith("swap") ? "swap" : "original";
    if (piece.links.some((l) => l.side === side && l.host && (l.host === host || host.endsWith(`.${l.host}`)))) return { kind: "primary", why: "the retailer page this look links" };
    const brand = squash((side === "swap" ? piece.swapBrand : piece.wornBrand) ?? "");
    if (brand.length >= 4 && squash(host.split(".").slice(0, -1).join("")).includes(brand)) return { kind: "primary", why: "the brand's own site" };
  }
  const handle = /@([a-z0-9._]{2,30})/i.exec(pack.look.photoCredit)?.[1]?.toLowerCase();
  if (handle && host === "instagram.com") {
    try {
      if (new URL(raw).pathname.split("/")[1]?.toLowerCase() === handle) return { kind: "primary", why: `the credited account @${handle}` };
    } catch {}
  }
  return { kind: "secondary", why: "other website" };
}

const grade = (sources: GradedSource[], agreedStatus: boolean): Grade => {
  if (!sources.length) return "D";
  const primary = sources.filter((s) => s.kind === "primary");
  if (!primary.length) return "C";
  const claude = new Set(primary.filter((s) => s.by === "claude").map((s) => sameSource(s.url)));
  if (agreedStatus && primary.some((s) => s.by === "codex" && claude.has(sameSource(s.url)))) return "A";
  return "B";
};

// ------------------------------------------------------------------ copy checks

const STOP = new Set(
  "a an and the of in on at for to by with from her his their its this that these those is are was were be get shop buy look looks outfit outfits style wear wore worn see find discover how what where who why when which complete full exact here new latest india indian".split(
    " ",
  ),
);
const wordsOf = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]+/g) ?? [];

function packVocabulary(pack: ResearchPack) {
  const L = pack.look;
  const text = [
    L.celebrity, L.event, L.occasions.join(" "), L.seoTitle, L.seoDescription, L.primaryKeyword, L.secondaryKeywords.join(" "), L.notes.join(" "),
    L.faqs.map((f) => `${f.question} ${f.answer}`).join(" "), L.photoCredit, L.imageAlts.join(" "),
    ...pack.pieces.map((p) => [p.name, p.category, p.colours.join(" "), p.wornBrand, p.swapBrand, p.note, ...p.links.map((l) => l.host)].join(" ")),
    ...pack.site.hubs.map((h) => h.name),
  ].join(" ");
  return new Set(wordsOf(text));
}

const PRICE = /(?:₹|rs\.?|inr)\s?([\d,]+)|\$\s?([\d,]+)/gi;

/** What is wrong with a piece of suggested copy: length, prices or names the pack does not contain, keyword stuffing. */
export function copyFlags(copy: { field: string; text: string }, pack: ResearchPack, keyword: string | null): string[] {
  const flags: string[] = [];
  const n = copy.text.length;
  if (copy.field === "seoTitle" && n > 60) flags.push(`title is ${n} characters (60 or fewer shows in full)`);
  if (copy.field === "seoDescription" && (n > 160 || n < 70)) flags.push(`description is ${n} characters (aim for 70–160)`);
  const prices = new Set(pack.pieces.flatMap((p) => [p.wornPriceInr, p.swapPriceInr]).filter((v): v is number => Boolean(v)).map(String));
  for (const m of copy.text.matchAll(PRICE)) {
    if (m[2]) flags.push("quotes a dollar price; the site prices in ₹");
    else if (!prices.has(m[1].replace(/,/g, ""))) flags.push(`mentions ₹${m[1]}, which is not a price in the pack`);
  }
  const vocab = packVocabulary(pack);
  const names = [...new Set((copy.text.match(/\b[A-Z][A-Za-z0-9'’&.-]+/g) ?? []).map((w) => w.replace(/['’]s$/, "")))]
    .filter((w) => wordsOf(w).some((part) => !vocab.has(part) && !STOP.has(part)));
  if (names.length) flags.push(`names words not in the pack: ${names.slice(0, 6).join(", ")} — check they are true`);
  if (keyword && phraseCount(copy.text, keyword) > 1) flags.push("repeats the keyword");
  return [...new Set(flags)];
}

// ------------------------------------------------------------------ compare

export type CompareInput = {
  pack: ResearchPack;
  claude: Findings;
  codex: Findings;
  challenge?: Findings;
  /** SHA-256 of each input file as read, for the record. */
  hashes: { claude: string; codex: string; challenge?: string };
};

const lookFacts = (pack: ResearchPack): LookFacts => ({
  celebrity: pack.look.celebrity,
  event: pack.look.event,
  occasions: pack.look.occasions,
  // Pack values are the form's own, read back as text; relevance() only compares words.
  items: pack.pieces.map((p) => ({ name: p.name, category: p.category || undefined, colours: p.colours, wornBrand: p.wornBrand, swapBrand: p.swapBrand })) as LookFacts["items"],
});

function graded(list: Source[], by: By, about: string, field: string, pack: ResearchPack): GradedSource[] {
  return list.map((s) => ({ ...s, by, ...classifySource(s.url, about, field, pack) }));
}

const ROLE_RANK: Record<string, number> = { primary: 0, secondary: 1, related: 2, rejected: 3 };

export function reconcile({ pack, claude, codex, challenge, hashes }: CompareInput): Reconciled {
  const verdicts = new Map((challenge?.challenges ?? []).map((c) => [c.target, { verdict: c.verdict, reason: c.reason }]));
  const disputedBy = (v?: Verdict) => v?.verdict === "disagree" || v?.verdict === "unsupported";

  // Facts: the pack's own checks, matched by id.
  const facts: ReconciledFact[] = pack.checks.map((check: PackCheck) => {
    const a = claude.checks.find((c) => c.id === check.id);
    const b = codex.checks.find((c) => c.id === check.id);
    const v = verdicts.get(check.id);
    const sources = [...graded(a?.sources ?? [], "claude", check.about, check.field, pack), ...graded(b?.sources ?? [], "codex", check.about, check.field, pack)];
    const agreed = Boolean(a && b && a.status === b.status);
    const g = grade(sources, agreed);
    let decision: FactDecision;
    if (!a || !b || !agreed || disputedBy(v)) decision = "disputed";
    else if (a.status === "unverifiable") decision = "unverified";
    else if (g === "A" || g === "B") decision = a.status === "confirmed" ? "verified" : "verified-contradiction";
    else decision = "unverified";
    return {
      id: check.id,
      about: check.about,
      field: check.field,
      statement: check.statement,
      ...(a ? { claude: { status: a.status, finding: a.finding, ...(a.correctedValue ? { correctedValue: a.correctedValue } : {}) } } : {}),
      ...(b ? { codex: { status: b.status, finding: b.finding, ...(b.correctedValue ? { correctedValue: b.correctedValue } : {}) } } : {}),
      ...(v ? { challenge: v } : {}),
      sources,
      grade: g,
      decision,
      preselected: decision === "verified" || decision === "verified-contradiction",
    };
  });

  // Facts either tool added: matched across tools on what they are about.
  const extra = [
    ...claude.additionalFacts.map((f) => ({ by: "claude" as By, f })),
    ...codex.additionalFacts.map((f) => ({ by: "codex" as By, f })),
  ];
  for (const { by, f } of extra) {
    const other = extra.find((e) => e.by !== by && e.f.about === f.about && e.f.field === f.field && f.field !== "other");
    if (other && by === "codex") continue; // reported once, on Claude's entry
    const v = by === "claude" ? verdicts.get(f.id) : undefined;
    const sources = [...graded(f.sources, by, f.about, f.field, pack), ...(other ? graded(other.f.sources, other.by, f.about, f.field, pack) : [])];
    const agreed = Boolean(other && other.f.status === f.status);
    const g = grade(sources, agreed);
    const decision: FactDecision = !other ? "single-tool" : !agreed || disputedBy(v) ? "disputed" : f.status === "unverifiable" ? "unverified" : g === "A" || g === "B" ? (f.status === "confirmed" ? "verified" : "verified-contradiction") : "unverified";
    const answer = (x: typeof f): Answer => ({ status: x.status, finding: x.claim });
    facts.push({
      id: `${by}:${f.id}`,
      about: f.about,
      field: f.field,
      statement: f.claim,
      ...(by === "claude" ? { claude: answer(f) } : { codex: answer(f) }),
      ...(other ? (other.by === "claude" ? { claude: answer(other.f) } : { codex: answer(other.f) }) : {}),
      ...(v ? { challenge: v } : {}),
      sources,
      grade: g,
      decision,
      preselected: decision === "verified" || decision === "verified-contradiction",
    });
  }

  // Keywords: matched on the normalised phrase.
  const look = lookFacts(pack);
  const published = new Map(pack.site.publishedLooks.flatMap((o) => o.keywords.map((k) => [k, o.slug] as const)));
  const allKeywords = [...new Set([...claude.keywords, ...codex.keywords].map((k) => k.keyword))].sort();
  const keywords: ReconciledKeyword[] = allKeywords.map((keyword) => {
    const a = claude.keywords.find((k) => k.keyword === keyword);
    const b = codex.keywords.find((k) => k.keyword === keyword);
    const v = verdicts.get(`K:${keyword}`);
    const fit = relevance(keyword, look);
    const overlap = published.get(keyword);
    const demand = [
      ...(a && a.demand.status === "observed" ? [{ by: "claude" as By, d: a.demand }] : []),
      ...(b && b.demand.status === "observed" ? [{ by: "codex" as By, d: b.demand }] : []),
    ].map(({ by, d }) => ({
      by,
      status: "observed" as const,
      sourceName: d.sourceName!,
      url: d.url!,
      value: d.value!,
      period: d.period!,
      market: d.market!,
      collectedAt: d.collectedAt!,
      ...(d.note ? { note: d.note } : {}),
    }));
    const blocked = fit.mismatches.length > 0 || Boolean(overlap) || disputedBy(v);
    let decision: KeywordDecision;
    if (!a || !b) decision = (a ?? b)!.role === "rejected" ? "rejected" : "single-tool";
    else if (a.role === "rejected" && b.role === "rejected") decision = "rejected";
    else if (a.role === "rejected" || b.role === "rejected" || blocked) decision = "disputed";
    else if (a.role === "primary" && b.role === "primary") decision = "recommended-primary";
    else decision = "agreed-supporting";
    const roles = [a?.role, b?.role].filter((r): r is (typeof ROLES)[number] => Boolean(r) && r !== "rejected");
    const best = roles.sort((x, y) => ROLE_RANK[y] - ROLE_RANK[x])[0]; // the more cautious role of the two
    const suggestedRole: ReconciledKeyword["suggestedRole"] = decision === "recommended-primary" ? "primary" : best === "secondary" || best === "primary" ? "secondary" : "related";
    const view = (k: typeof a) => (k ? { role: k.role, intent: k.intent, rationale: k.rationale } : undefined);
    return {
      id: `K:${keyword}`,
      keyword,
      ...(a ? { claude: view(a) } : {}),
      ...(b ? { codex: view(b) } : {}),
      ...(v ? { challenge: v } : {}),
      mismatches: fit.mismatches,
      overlaps: overlap ? [`/outfits/${overlap} already targets it`] : [],
      demand,
      decision,
      suggestedRole,
      preselected: decision === "recommended-primary" || decision === "agreed-supporting",
    };
  });

  const primary = keywords.find((k) => k.decision === "recommended-primary")?.keyword ?? null;

  // Recommendations: each tool's own, with what the other said about the same area.
  const areasBy = (f: Findings) => new Set(f.recommendations.map((r) => r.area));
  const claudeAreas = areasBy(claude);
  const codexAreas = areasBy(codex);
  const recommendations: ReconciledRecommendation[] = [
    ...claude.recommendations.map((r) => ({ by: "claude" as By, r })),
    ...codex.recommendations.map((r) => ({ by: "codex" as By, r })),
  ].map(({ by, r }) => {
    const v = by === "claude" ? verdicts.get(r.id) : undefined;
    const both = claudeAreas.has(r.area) && codexAreas.has(r.area);
    const flags = r.copy ? copyFlags(r.copy, pack, primary ?? pack.look.primaryKeyword ?? null) : [];
    if (by === "codex") flags.push("not cross-checked: the challenge pass reviews Claude's findings only");
    const copyRisky = r.copy ? flags.some((f) => /not a price|dollar|not in the pack/.test(f)) : false;
    return {
      id: `${by}:${r.id}`,
      by,
      area: r.area,
      severity: r.severity,
      issue: r.issue,
      fix: r.fix,
      ...(r.copy ? { copy: r.copy } : {}),
      sources: graded(r.sources, by, "look", "other", pack),
      bothRaisedArea: both,
      ...(v ? { challenge: v } : {}),
      flags,
      preselected: both && !disputedBy(v) && !copyRisky && (by === "codex" || v?.verdict === "agree" || v?.verdict === "partly" || !challenge),
    };
  });

  const gaps = [
    ...claude.gaps.map((g) => ({ by: "claude" as By, ...g })),
    ...codex.gaps.map((g) => ({ by: "codex" as By, ...g })),
    ...(challenge?.gaps ?? []).map((g) => ({ by: "codex" as By, ...g })),
  ];

  const pickCopy = (field: string) => {
    const options = recommendations.filter((r) => r.copy?.field === field);
    const score = (r: ReconciledRecommendation) => (r.flags.filter((f) => !f.startsWith("not cross-checked")).length * 10) + (primary && r.copy!.text.toLowerCase().includes(primary) ? 0 : 5) + (r.by === "claude" ? 0 : 1);
    const best = [...options].sort((x, y) => score(x) - score(y) || x.id.localeCompare(y.id))[0];
    return best ? { text: best.copy!.text, from: best.id, flags: best.flags } : undefined;
  };

  const contradicted = facts.filter((f) => f.decision === "verified-contradiction");
  const disputed = facts.filter((f) => f.decision === "disputed");
  const unverified = facts.filter((f) => f.decision === "unverified" && pack.checks.some((c) => c.id === f.id));
  const uncertainties = [
    ...contradicted.map((f) => `${f.id} contradicted by both tools with a primary source: ${f.statement}${f.claude?.correctedValue ? ` → ${f.claude.correctedValue}` : ""}`),
    ...disputed.map((f) => `${f.id} disputed: ${f.statement}`),
    ...unverified.map((f) => `${f.id} not verified (grade ${f.grade}): ${f.statement}`),
  ];
  const highRecs = recommendations.filter((r) => r.preselected && r.severity === "high");
  const reasons = [
    ...(pack.audit.blockers.length ? [`${pack.audit.blockers.length} publishing blocker(s) in the site checklist`] : []),
    ...(contradicted.length ? [`${contradicted.length} fact(s) contradicted by sources`] : []),
    ...(disputed.length ? [`${disputed.length} fact(s) disputed between the tools`] : []),
    ...(primary ? [] : ["no primary keyword both tools agree on"]),
    ...(highRecs.length ? [`${highRecs.length} high-priority improvement(s) both tools raised`] : []),
    ...(pack.basis === "saved" ? [] : ["the pack was made from unsaved edits or an unsaved look"]),
  ];
  const shared = sharedPassages(claude, codex);
  const warnings = shared.length >= 3 ? [`Claude's and Codex's findings share ${shared.length} identical long passages — the passes may not have been independent. Compare them with care.`] : [];
  const intentA = claude.searchIntent!;
  const intentB = codex.searchIntent!;

  return {
    schema: RECONCILED_SCHEMA,
    pack: { key: pack.key, fingerprint: pack.fingerprint, slug: pack.look.slug, celebrity: pack.look.celebrity },
    comparedFrom: [claude.completedAt, codex.completedAt, challenge?.completedAt ?? ""].sort().at(-1)!,
    inputs: [
      { tool: claude.tool, pass: claude.pass, completedAt: claude.completedAt, sha256: hashes.claude },
      { tool: codex.tool, pass: codex.pass, completedAt: codex.completedAt, sha256: hashes.codex },
      ...(challenge && hashes.challenge ? [{ tool: challenge.tool, pass: challenge.pass, completedAt: challenge.completedAt, sha256: hashes.challenge }] : []),
    ],
    summary: {
      primaryKeyword: {
        keyword: primary,
        status: primary ? "Both tools chose it, it fits the look, and no published look targets it." : "No agreement — the editor decides.",
        alternatives: keywords.filter((k) => k.keyword !== primary && (k.claude?.role === "primary" || k.codex?.role === "primary")).map((k) => k.keyword),
      },
      supporting: keywords.filter((k) => k.decision === "agreed-supporting").map((k) => k.keyword),
      demand: keywords
        .filter((k) => k.decision === "recommended-primary" || k.decision === "agreed-supporting")
        .map((k) => {
          const recorded = pack.research.candidates.find((c) => c.keyword === k.keyword)?.evidence.length ?? 0;
          return {
            keyword: k.keyword,
            status: recorded ? `${recorded} observation(s) already recorded by the editor` : k.demand.length ? `${k.demand.length} figure(s) reported by the tools — open the source and verify before recording` : "Unknown — no evidence (not zero)",
          };
        }),
      intent: { claude: intentA.primary, codex: intentB.primary, agreed: intentA.primary === intentB.primary, explanation: intentA.primary === intentB.primary ? intentA.explanation : `Claude: ${intentA.explanation} — Codex: ${intentB.explanation}` },
      uncertainties,
      // The same fix from both tools is listed once.
      improvements: [
        ...new Set([
          ...pack.audit.blockers.map((b) => `Blocker: ${b.title}`),
          ...recommendations.filter((r) => r.preselected).sort((x, y) => ["high", "medium", "low"].indexOf(x.severity) - ["high", "medium", "low"].indexOf(y.severity)).map((r) => `${r.severity}: ${r.fix}`),
        ]),
      ],
      ...(pickCopy("seoTitle") ? { suggestedTitle: pickCopy("seoTitle") } : {}),
      ...(pickCopy("seoDescription") ? { suggestedDescription: pickCopy("seoDescription") } : {}),
      readyForReview: { ready: reasons.length === 0, reasons },
      warnings,
    },
    facts,
    keywords,
    recommendations,
    gaps,
  };
}

/** Sentences of 40+ characters that appear word for word in both tools' findings. */
export function sharedPassages(a: Findings, b: Findings): string[] {
  const sentences = (f: Findings) =>
    new Set(
      [f.searchIntent?.explanation ?? "", ...f.checks.map((c) => c.finding), ...f.keywords.map((k) => k.rationale), ...f.recommendations.flatMap((r) => [r.issue, r.fix])]
        .join(" ")
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.toLowerCase().replace(/\s+/g, " ").trim())
        .filter((s) => s.length >= 40),
    );
  const other = sentences(b);
  return [...sentences(a)].filter((s) => other.has(s)).sort();
}

// ------------------------------------------------------------------ comparison.md

const STATUS_WORD: Record<string, string> = { confirmed: "confirmed", contradicted: "contradicted", unverifiable: "unverifiable" };
const DECISION_WORD: Record<FactDecision, string> = {
  verified: "Supported",
  "verified-contradiction": "Contradicted (supported)",
  unverified: "Not supported",
  disputed: "Disputed",
  "single-tool": "One tool only",
};
const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 300);

export function comparisonMarkdown(r: Reconciled): string {
  const s = r.summary;
  const out: string[] = [];
  out.push(`# SEO research comparison — ${r.pack.celebrity} (${r.pack.key})`, "");
  out.push(`Fingerprint \`${r.pack.fingerprint}\` · latest input ${r.comparedFrom}. Advice for a human editor. Nothing here predicts traffic or rankings.`, "");
  for (const w of s.warnings) out.push(`> **Warning:** ${w}`, "");
  out.push("## Final research summary", "");
  out.push(`**Recommended primary keyword:** ${s.primaryKeyword.keyword ? `“${s.primaryKeyword.keyword}”` : "none agreed"} — ${s.primaryKeyword.status}`);
  if (s.primaryKeyword.alternatives.length) out.push(`  Other primary proposals: ${s.primaryKeyword.alternatives.map((k) => `“${k}”`).join(", ")}`);
  out.push(`**Supporting keywords:** ${s.supporting.length ? s.supporting.map((k) => `“${k}”`).join(", ") : "none agreed"}`);
  out.push(`**Demand evidence:** ${s.demand.length ? "" : "no agreed keywords to report on."}`);
  for (const d of s.demand) out.push(`- “${d.keyword}”: ${d.status}`);
  out.push(`**Search intent:** ${s.intent.agreed ? s.intent.claude : `Claude says ${s.intent.claude}, Codex says ${s.intent.codex}`} — ${s.intent.explanation}`);
  out.push(`**Factual uncertainties:** ${s.uncertainties.length ? "" : "none — every checked fact is supported by a cited primary source (open them to confirm)."}`);
  for (const u of s.uncertainties) out.push(`- ${u}`);
  out.push(`**Required improvements:** ${s.improvements.length ? "" : "none agreed."}`);
  for (const i of s.improvements) out.push(`- ${i}`);
  out.push(`**Suggested title:** ${s.suggestedTitle ? `“${s.suggestedTitle.text}” (${s.suggestedTitle.from}${s.suggestedTitle.flags.length ? `; ${s.suggestedTitle.flags.join("; ")}` : ""})` : "none proposed"}`);
  out.push(`**Suggested description:** ${s.suggestedDescription ? `“${s.suggestedDescription.text}” (${s.suggestedDescription.from}${s.suggestedDescription.flags.length ? `; ${s.suggestedDescription.flags.join("; ")}` : ""})` : "none proposed"}`);
  out.push(
    `**Ready for human publication review:** ${s.readyForReview.ready ? "yes — an editor should still read the page before publishing." : `not yet — ${s.readyForReview.reasons.join("; ")}.`}`,
    "",
  );
  out.push("## How this was graded", "");
  out.push("- A: both tools cite the same primary source · B: at least one primary source · C: secondary sources only · D: no source.");
  out.push("- Primary source: the retailer page this look links for the piece, the brand's own site, or the Instagram account in the photo credit.");
  out.push("- Agreement alone is not verification: a fact counts as supported only when both tools agree AND the grade is A or B. Everything else stays unticked.");
  out.push("- A grade says a source was cited, not that the source says what is claimed or that the claim is true. Open the sources before keeping anything.", "");
  out.push("## Facts", "", "| Id | Statement | Claude | Codex | Challenge | Grade | Decision |", "|---|---|---|---|---|---|---|");
  for (const f of r.facts) {
    out.push(`| ${f.id} | ${cell(f.statement)} | ${f.claude ? STATUS_WORD[f.claude.status] : "—"} | ${f.codex ? STATUS_WORD[f.codex.status] : "—"} | ${f.challenge?.verdict ?? "—"} | ${f.grade} | ${DECISION_WORD[f.decision]}${f.preselected ? " ✓" : ""} |`);
  }
  out.push("", "## Keywords", "", "| Keyword | Claude | Codex | Challenge | Fit / overlap | Demand | Decision |", "|---|---|---|---|---|---|---|");
  for (const k of r.keywords) {
    out.push(
      `| ${cell(k.keyword)} | ${k.claude?.role ?? "—"} | ${k.codex?.role ?? "—"} | ${k.challenge?.verdict ?? "—"} | ${cell([...k.mismatches, ...k.overlaps].join("; ") || "fits")} | ${k.demand.length ? `${k.demand.length} reported (verify)` : "unknown"} | ${k.decision}${k.preselected ? " ✓" : ""} |`,
    );
  }
  out.push("", "## Recommendations", "");
  for (const rec of r.recommendations) {
    out.push(`- **${rec.id}** [${rec.severity}, ${rec.area}]${rec.preselected ? " ✓" : ""} ${rec.issue}`);
    out.push(`  - Fix: ${rec.fix}`);
    if (rec.copy) out.push(`  - Copy (${rec.copy.field}): “${rec.copy.text}”`);
    if (rec.challenge) out.push(`  - Codex challenge: ${rec.challenge.verdict} — ${rec.challenge.reason}`);
    out.push(`  - ${rec.bothRaisedArea ? "Both tools raised this area." : "Only one tool raised this area."}${rec.flags.length ? ` Flags: ${rec.flags.join("; ")}.` : ""}`);
  }
  if (r.gaps.length) {
    out.push("", "## Gaps", "");
    for (const g of r.gaps) out.push(`- ${g.by} (${g.area}): ${g.note}`);
  }
  out.push("", "## Sources cited", "");
  const seen = new Set<string>();
  for (const src of [...r.facts.flatMap((f) => f.sources), ...r.recommendations.flatMap((x) => x.sources)]) {
    const k = `${src.by} ${src.url}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(`- ${src.by}, ${src.kind} (${src.why}), accessed ${src.accessedAt}: ${src.url}`);
  }
  out.push("", "## Inputs", "");
  for (const i of r.inputs) out.push(`- ${i.tool} ${i.pass}, completed ${i.completedAt}, sha256 ${i.sha256}`);
  out.push("", "✓ = pre-ticked for import. The editor decides; nothing is applied automatically.", "");
  return out.join("\n");
}

// ------------------------------------------------------------------ import check

const verdict = obj({ verdict: str(12, { enum: VERDICTS }), reason: str(600) }, true);
const gsrc = obj({ url: url(), accessedAt: date(), title: optional(str(200)), quote: optional(str(300)), by: str(6, { enum: ["claude", "codex"] }), kind: str(10, { enum: ["primary", "secondary"] }), why: str(80) });
const answer = obj({ status: str(20, { enum: STATUSES }), finding: str(600), correctedValue: optional(str(200)) }, true);
const role = obj({ role: str(20, { enum: ROLES }), intent: str(30, { enum: INTENTS }), rationale: str(600) }, true);
const copyText = obj({ field: str(20, { enum: COPY_FIELDS }), text: str(1200) }, true);
const pickedCopy = obj({ text: str(1200), from: str(40), flags: arr(str(300), 20) }, true);

const reconciledSchema: Schema = obj({
  schema: lit(RECONCILED_SCHEMA),
  pack: obj({ key: str(110, { re: /^(outfit:\d{1,9}|prepared:[a-z0-9]+(?:-[a-z0-9]+)*)$/ }), fingerprint: str(64, { re: /^[0-9a-f]{64}$/ }), slug: str(120), celebrity: str(80) }),
  comparedFrom: date(),
  inputs: arr(obj({ tool: str(20), pass: str(20), completedAt: date(), sha256: str(64, { re: /^[0-9a-f]{64}$/ }) }), 3),
  summary: obj({
    primaryKeyword: obj({ keyword: optional(str(80)), status: str(200), alternatives: arr(str(80), 20) }),
    supporting: arr(str(80), 20),
    demand: arr(obj({ keyword: str(80), status: str(200) }), 20),
    intent: obj({ claude: str(30), codex: str(30), agreed: bool(), explanation: str(1300) }),
    uncertainties: arr(str(700), 250),
    improvements: arr(str(700), 100),
    suggestedTitle: pickedCopy,
    suggestedDescription: pickedCopy,
    readyForReview: obj({ ready: bool(), reasons: arr(str(200), 10) }),
    warnings: arr(str(300), 5),
  }),
  facts: arr(
    obj({
      id: str(20, { re: /^(F\d{1,3}|(claude|codex):X\d{1,3})$/ }),
      about: str(4),
      field: str(20),
      statement: str(600),
      claude: answer,
      codex: answer,
      challenge: verdict,
      sources: arr(gsrc, 16),
      grade: str(1, { enum: ["A", "B", "C", "D"] }),
      decision: str(30, { enum: ["verified", "verified-contradiction", "unverified", "disputed", "single-tool"] }),
      preselected: bool(),
    }),
    260,
  ),
  keywords: arr(
    obj({
      id: str(90),
      keyword: str(80),
      claude: role,
      codex: role,
      challenge: verdict,
      mismatches: arr(str(300), 5),
      overlaps: arr(str(300), 5),
      demand: arr(
        obj({ by: str(6, { enum: ["claude", "codex"] }), status: lit("observed"), sourceName: str(80), url: url(), value: str(40), period: str(60), market: str(6), collectedAt: date(), note: optional(str(300)) }),
        2,
      ),
      decision: str(30, { enum: ["recommended-primary", "agreed-supporting", "disputed", "single-tool", "rejected"] }),
      suggestedRole: str(10, { enum: ["primary", "secondary", "related"] }),
      preselected: bool(),
    }),
    40,
  ),
  recommendations: arr(
    obj({
      id: str(20, { re: /^(claude|codex):R\d{1,3}$/ }),
      by: str(6, { enum: ["claude", "codex"] }),
      area: str(20, { enum: AREAS }),
      severity: str(10, { enum: ["high", "medium", "low"] }),
      issue: str(400),
      fix: str(600),
      copy: copyText,
      sources: arr(gsrc, 8),
      bothRaisedArea: bool(),
      challenge: verdict,
      flags: arr(str(300), 20),
      preselected: bool(),
    }),
    60,
  ),
  gaps: arr(obj({ by: str(6, { enum: ["claude", "codex"] }), area: str(20, { enum: GAP_AREAS }), note: str(400) }), 60),
});

/**
 * The admin import's check of reconciled.json: schema, then that it belongs to
 * this look as it stands now. `current` is the fingerprint of the form as it
 * is on screen.
 */
export function checkReconciled(raw: unknown, expected: { key: string | null; fingerprint: string | null }): { ok: true; value: Reconciled } | { ok: false; errors: string[] } {
  const errors = validate(raw, reconciledSchema);
  if (errors.length) return { ok: false, errors: errors.slice(0, 40) };
  const r = raw as Reconciled;
  if (!expected.key) return { ok: false, errors: ["This look has no slug yet, so research cannot be matched to it."] };
  if (r.pack.key !== expected.key) return { ok: false, errors: [`These findings are for ${r.pack.key}, not this look (${expected.key}). Nothing was imported.`] };
  if (r.pack.fingerprint !== expected.fingerprint) {
    return { ok: false, errors: ["The look has changed since this research pack was exported, so the findings may describe content that is no longer there. Download a new pack and run the research again. Nothing was imported."] };
  }
  const inconsistent = consistencyProblems(r);
  if (inconsistent.length) return { ok: false, errors: ["This file does not match what the compare command produces — it may have been edited by hand. Nothing was imported.", ...inconsistent.slice(0, 10)] };
  return { ok: true, value: r };
}

/**
 * reconciled.json is not signed, so a hand-edited file could call an
 * unsupported claim "verified". It cannot be proven untouched, but it can be
 * held to the rules that produced it: a grade its own sources support, a
 * decision its grade allows, and a pre-tick only where the rules give one.
 */
export function consistencyProblems(r: Reconciled): string[] {
  const problems: string[] = [];
  for (const f of r.facts) {
    const primary = f.sources.filter((s) => s.kind === "primary");
    const possible: Grade = !f.sources.length ? "D" : !primary.length ? "C" : f.grade === "A" ? "A" : "B";
    if (f.grade !== possible) problems.push(`${f.id}: grade ${f.grade} does not match its sources.`);
    if (f.grade === "A" && !(primary.some((s) => s.by === "claude") && primary.some((s) => s.by === "codex"))) problems.push(`${f.id}: grade A needs a primary source from both tools.`);
    const verified = f.decision === "verified" || f.decision === "verified-contradiction";
    if (verified && !(f.grade === "A" || f.grade === "B")) problems.push(`${f.id}: “${f.decision}” needs grade A or B.`);
    if (verified && !(f.claude && f.codex && f.claude.status === f.codex.status)) problems.push(`${f.id}: “${f.decision}” needs both tools to agree.`);
    if (verified && (f.challenge?.verdict === "disagree" || f.challenge?.verdict === "unsupported")) problems.push(`${f.id}: a disputed fact cannot be “${f.decision}”.`);
    if (f.preselected !== verified) problems.push(`${f.id}: pre-ticked does not follow its decision.`);
  }
  for (const k of r.keywords) {
    const agreed = k.decision === "recommended-primary" || k.decision === "agreed-supporting";
    if (agreed && !(k.claude && k.codex)) problems.push(`${k.keyword}: “${k.decision}” needs both tools.`);
    if (agreed && (k.mismatches.length || k.overlaps.length)) problems.push(`${k.keyword}: a keyword that does not fit the look cannot be “${k.decision}”.`);
    if (k.preselected !== agreed) problems.push(`${k.keyword}: pre-ticked does not follow its decision.`);
    if (k.suggestedRole === "primary" && k.decision !== "recommended-primary") problems.push(`${k.keyword}: only an agreed primary keyword is suggested as primary.`);
  }
  for (const rec of r.recommendations) {
    if (rec.preselected && (!rec.bothRaisedArea || rec.challenge?.verdict === "disagree" || rec.challenge?.verdict === "unsupported")) problems.push(`${rec.id}: pre-ticked without both tools, or despite a dispute.`);
  }
  return problems;
}
