/**
 * The findings file each research pass writes (`cp-seo-findings/1`), and its
 * validation: the schema first, then the rules a schema cannot say.
 *
 *   research   Claude's independent research
 *   blind      Codex's independent research, made without Claude's findings
 *   challenge  Codex's review of Claude's findings: verdicts and gaps only
 *
 * Nothing in a findings file is trusted. It is checked here, compared in
 * reconcile.ts, and shown to an editor as plain text.
 */

import { CHECK_FIELDS, type ResearchPack } from "@/lib/seo-review/pack";
import { arr, date, lit, obj, optional, str, url, validate, type Schema } from "@/lib/seo-review/schema";

export const FINDINGS_SCHEMA = "cp-seo-findings/1";
export const TOOLS = ["claude-code", "codex"] as const;
export const PASSES = ["research", "blind", "challenge"] as const;
export const STATUSES = ["confirmed", "contradicted", "unverifiable"] as const;
export const INTENTS = ["identify-outfit", "buy", "style-inspiration", "celebrity-news", "unclear"] as const;
export const ROLES = ["primary", "secondary", "related", "rejected"] as const;
export const AREAS = ["keyword", "title", "description", "url", "content", "products", "pricing", "faqs", "images", "links", "structured-data"] as const;
export const GAP_AREAS = [...AREAS, "facts", "intent", "competition"] as const;
export const COPY_FIELDS = ["seoTitle", "seoDescription", "primaryKeyword", "faq", "notes", "imageAlt"] as const;
export const VERDICTS = ["agree", "partly", "disagree", "unsupported"] as const;

const KEYWORD = /^[a-z0-9À-ɏ][a-z0-9À-ɏ' &.-]{0,78}[a-z0-9À-ɏ]$/;
const source = obj({ url: url(), accessedAt: date(), title: optional(str(200)), quote: optional(str(300)) });
const sources = (max = 8) => arr(source, max);

const findingsSchema: Schema = obj({
  schema: lit(FINDINGS_SCHEMA),
  tool: str(20, { enum: TOOLS }),
  pass: str(20, { enum: PASSES }),
  pack: obj({ key: str(110, { re: /^(outfit:\d{1,9}|prepared:[a-z0-9]+(?:-[a-z0-9]+)*)$/ }), fingerprint: str(64, { re: /^[0-9a-f]{64}$/ }) }),
  completedAt: date(),
  searchIntent: obj(
    {
      primary: str(30, { enum: INTENTS }),
      secondary: optional(arr(str(30, { enum: INTENTS }), 3)),
      explanation: str(600, { min: 1 }),
      sources: sources(),
    },
    true,
  ),
  checks: arr(
    obj({
      id: str(5, { re: /^F\d{1,3}$/ }),
      status: str(20, { enum: STATUSES }),
      finding: str(600, { min: 1 }),
      correctedValue: optional(str(200)),
      sources: sources(),
    }),
    200,
  ),
  additionalFacts: arr(
    obj({
      id: str(5, { re: /^X\d{1,3}$/ }),
      about: str(4, { re: /^(look|P\d{1,2})$/ }),
      field: str(20, { enum: [...CHECK_FIELDS, "other"] }),
      claim: str(400, { min: 1 }),
      status: str(20, { enum: STATUSES }),
      sources: sources(),
    }),
    30,
  ),
  keywords: arr(
    obj({
      keyword: str(80, { re: KEYWORD }),
      role: str(20, { enum: ROLES }),
      intent: str(30, { enum: INTENTS }),
      rationale: str(600, { min: 1 }),
      demand: obj({
        status: str(10, { enum: ["unknown", "observed"] }),
        note: optional(str(300)),
        sourceName: optional(str(80)),
        url: url(true),
        value: optional(str(40)),
        period: optional(str(60)),
        market: optional(str(6, { re: /^([A-Z]{2}|GLOBAL)$/ })),
        collectedAt: date(true),
      }),
      risks: arr(str(200), 5),
    }),
    20,
  ),
  competition: arr(
    obj({ keyword: str(80, { re: KEYWORD }), method: lit("tool-web-search"), observations: arr(str(300, { min: 1 }), 8), sources: sources(10) }),
    10,
  ),
  recommendations: arr(
    obj({
      id: str(5, { re: /^R\d{1,3}$/ }),
      area: str(20, { enum: AREAS }),
      severity: str(10, { enum: ["high", "medium", "low"] }),
      issue: str(400, { min: 1 }),
      fix: str(600, { min: 1 }),
      copy: optional(obj({ field: str(20, { enum: COPY_FIELDS }), text: str(1200, { min: 1 }) })),
      sources: sources(),
    }),
    30,
  ),
  challenges: arr(
    obj({
      target: str(90, { re: /^(F\d{1,3}|X\d{1,3}|R\d{1,3}|K:.{1,80})$/ }),
      verdict: str(12, { enum: VERDICTS }),
      reason: str(600, { min: 1 }),
      sources: sources(),
    }),
    150,
  ),
  gaps: arr(obj({ area: str(20, { enum: GAP_AREAS }), note: str(400, { min: 1 }) }), 20),
});

export type Source = { url: string; accessedAt: string; title?: string; quote?: string };
export type Status = (typeof STATUSES)[number];
export type Demand = {
  status: "unknown" | "observed";
  note?: string;
  sourceName?: string;
  url?: string;
  value?: string;
  period?: string;
  market?: string;
  collectedAt?: string;
};
export type Findings = {
  schema: typeof FINDINGS_SCHEMA;
  tool: (typeof TOOLS)[number];
  pass: (typeof PASSES)[number];
  pack: { key: string; fingerprint: string };
  completedAt: string;
  searchIntent?: { primary: (typeof INTENTS)[number]; secondary?: (typeof INTENTS)[number][]; explanation: string; sources: Source[] };
  checks: { id: string; status: Status; finding: string; correctedValue?: string; sources: Source[] }[];
  additionalFacts: { id: string; about: string; field: string; claim: string; status: Status; sources: Source[] }[];
  keywords: { keyword: string; role: (typeof ROLES)[number]; intent: (typeof INTENTS)[number]; rationale: string; demand: Demand; risks: string[] }[];
  competition: { keyword: string; method: "tool-web-search"; observations: string[]; sources: Source[] }[];
  recommendations: { id: string; area: (typeof AREAS)[number]; severity: "high" | "medium" | "low"; issue: string; fix: string; copy?: { field: (typeof COPY_FIELDS)[number]; text: string }; sources: Source[] }[];
  challenges: { target: string; verdict: (typeof VERDICTS)[number]; reason: string; sources: Source[] }[];
  gaps: { area: string; note: string }[];
};

const dupes = (list: string[]) => [...new Set(list.filter((v, i) => list.indexOf(v) !== i))];

/**
 * Schema, then meaning. `expected` is the pass this file should be; `pack` is
 * the pack it must belong to. Returns every problem, in words a person can
 * paste back to the tool.
 */
export function checkFindings(raw: unknown, pack: Pick<ResearchPack, "key" | "fingerprint" | "checks">, expected: Findings["pass"], today: string): { ok: true; value: Findings } | { ok: false; errors: string[] } {
  const errors = validate(raw, findingsSchema);
  if (errors.length) return { ok: false, errors: errors.slice(0, 60) };
  const f = raw as Findings;

  if (f.pass !== expected) errors.push(`$.pass: this file should be the “${expected}” pass, not “${f.pass}”.`);
  if (expected === "research" && f.tool !== "claude-code") errors.push("$.tool: the research pass is Claude Code's.");
  if (expected !== "research" && f.tool !== "codex") errors.push(`$.tool: the ${expected} pass is Codex's.`);
  if (f.pack.key !== pack.key) errors.push(`$.pack.key: made for ${f.pack.key}, but this pack is ${pack.key}.`);
  if (f.pack.fingerprint !== pack.fingerprint) errors.push("$.pack.fingerprint: made from a different version of the look. Re-run it on this pack.");
  if (f.completedAt > today) errors.push("$.completedAt: in the future.");

  const allSources: [string, Source][] = [
    ...(f.searchIntent?.sources ?? []).map((s) => ["$.searchIntent", s] as [string, Source]),
    ...f.checks.flatMap((c) => c.sources.map((s) => [`check ${c.id}`, s] as [string, Source])),
    ...f.additionalFacts.flatMap((c) => c.sources.map((s) => [`fact ${c.id}`, s] as [string, Source])),
    ...f.competition.flatMap((c) => c.sources.map((s) => [`competition “${c.keyword}”`, s] as [string, Source])),
    ...f.recommendations.flatMap((r) => r.sources.map((s) => [`recommendation ${r.id}`, s] as [string, Source])),
    ...f.challenges.flatMap((c) => c.sources.map((s) => [`challenge ${c.target}`, s] as [string, Source])),
  ];
  for (const [where, s] of allSources) if (s.accessedAt > today) errors.push(`${where}: a source's accessedAt is in the future.`);
  for (const [where, text] of freeText(f)) {
    const metric = inventedMetric(text);
    if (metric) errors.push(`${where}: “${metric}” is an estimated metric. Search volume, difficulty, ranking chances and traffic are never estimated; cite observed demand under keywords[].demand or say it is unknown.`);
  }

  if (f.pass === "challenge") {
    for (const field of ["checks", "additionalFacts", "keywords", "competition", "recommendations"] as const) {
      if (f[field].length) errors.push(`$.${field}: the challenge pass gives verdicts only; leave this empty.`);
    }
    if (!f.challenges.length) errors.push("$.challenges: the challenge pass needs at least one verdict.");
    for (const d of dupes(f.challenges.map((c) => c.target))) errors.push(`$.challenges: “${d}” is judged twice.`);
    for (const c of f.challenges) {
      if ((c.verdict === "disagree" || c.verdict === "partly") && !c.sources.length && c.reason.length < 20) errors.push(`challenge ${c.target}: explain the disagreement or cite a source.`);
    }
    return errors.length ? { ok: false, errors } : { ok: true, value: f };
  }

  if (f.challenges.length) errors.push("$.challenges: only the challenge pass gives verdicts; leave this empty.");
  if (!f.searchIntent) errors.push("$.searchIntent: required in this pass.");
  const known = new Set(pack.checks.map((c) => c.id));
  for (const c of f.checks) if (!known.has(c.id)) errors.push(`$.checks: ${c.id} is not a check in this pack.`);
  for (const d of dupes(f.checks.map((c) => c.id))) errors.push(`$.checks: ${d} is answered twice.`);
  const answered = new Set(f.checks.map((c) => c.id));
  const missing = pack.checks.filter((c) => !answered.has(c.id)).map((c) => c.id);
  if (missing.length) errors.push(`$.checks: no answer for ${missing.join(", ")}. Every check needs confirmed, contradicted or unverifiable.`);
  for (const c of [...f.checks, ...f.additionalFacts]) {
    if (c.status !== "unverifiable" && !c.sources.length) errors.push(`${c.id}: “${c.status}” needs at least one source; without one, say “unverifiable”.`);
  }
  for (const d of dupes(f.additionalFacts.map((c) => c.id))) errors.push(`$.additionalFacts: ${d} is used twice.`);

  for (const d of dupes(f.keywords.map((k) => k.keyword))) errors.push(`$.keywords: “${d}” is listed twice.`);
  if (f.keywords.filter((k) => k.role === "primary").length > 1) errors.push("$.keywords: only one keyword can be primary.");
  for (const k of f.keywords) {
    const d = k.demand;
    if (d.status === "unknown") {
      if (d.url || d.value || d.sourceName || d.period || d.market || d.collectedAt) errors.push(`keyword “${k.keyword}”: unknown demand carries no figures or sources — put them under "observed", or leave them out.`);
      continue;
    }
    const missingParts = (["sourceName", "url", "value", "period", "market", "collectedAt"] as const).filter((p) => !d[p]);
    if (missingParts.length) errors.push(`keyword “${k.keyword}”: observed demand needs ${missingParts.join(", ")}. Without a citable source, demand is "unknown".`);
    if (d.collectedAt && d.collectedAt > today) errors.push(`keyword “${k.keyword}”: demand collectedAt is in the future.`);
    if (d.value && /\b(est|estimate|approx|about|around|~)\b|~/i.test(d.value)) errors.push(`keyword “${k.keyword}”: “${d.value}” looks like an estimate. Report only a figure a source shows.`);
  }

  for (const d of dupes(f.recommendations.map((r) => r.id))) errors.push(`$.recommendations: ${d} is used twice.`);
  return errors.length ? { ok: false, errors } : { ok: true, value: f };
}

/** Phrases that state or promise numbers no research pass can know. */
const METRIC_PATTERNS = [
  /\b\d[\d,.]*\s*[kKmM]?\+?\s*(?:monthly\s+|per\s+month\s+)?(?:searches|search\s+volume|visits|visitors|clicks|sessions|pageviews)\b/i,
  /\bsearch\s+volume\s+(?:of|is|around|about|~)\s*\d/i,
  /\bkeyword\s+difficulty\b|\bKD\s*[:=]?\s*\d/i,
  /\b(?:ranking|rank)\s+(?:probability|chance|likelihood)\b|\bchance\s+(?:of|to)\s+rank/i,
  /\bwill\s+(?:rank|reach\s+(?:the\s+)?(?:top|first\s+page|page\s+one))\b|\bguarantee[sd]?\s+(?:a\s+)?(?:traffic|rankings?|top|first|#1|position|results)\b/i,
  /\b(?:estimated|expected|projected)\s+(?:traffic|visits|clicks|searches)\b/i,
];

export function inventedMetric(text: string): string | null {
  for (const pattern of METRIC_PATTERNS) {
    const match = pattern.exec(text);
    if (match) return match[0];
  }
  return null;
}

function freeText(f: Findings): [string, string][] {
  return [
    ...(f.searchIntent ? [["$.searchIntent.explanation", f.searchIntent.explanation] as [string, string]] : []),
    ...f.checks.map((c) => [`check ${c.id}`, `${c.finding} ${c.correctedValue ?? ""}`] as [string, string]),
    ...f.additionalFacts.map((c) => [`fact ${c.id}`, c.claim] as [string, string]),
    ...f.keywords.map((k) => [`keyword “${k.keyword}”`, `${k.rationale} ${k.risks.join(" ")} ${k.demand.status === "unknown" ? (k.demand.note ?? "") : ""}`] as [string, string]),
    ...f.competition.map((c) => [`competition “${c.keyword}”`, c.observations.join(" ")] as [string, string]),
    ...f.recommendations.map((r) => [`recommendation ${r.id}`, `${r.issue} ${r.fix} ${r.copy?.text ?? ""}`] as [string, string]),
    ...f.challenges.map((c) => [`challenge ${c.target}`, c.reason] as [string, string]),
    ...f.gaps.map((g, i) => [`gap ${i + 1}`, g.note] as [string, string]),
  ];
}
