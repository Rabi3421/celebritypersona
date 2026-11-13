/**
 * The whole pre-publish review for one look, as the panel shows it.
 *
 * Two answers, kept apart on purpose:
 *  - content readiness: how many of the review's checks pass. It measures the
 *    page, and says nothing about whether anyone searches for it — so it is
 *    always labelled as not being a traffic prediction;
 *  - demand evidence: what has been recorded about searches for the keyword,
 *    with sources, or "unknown". Never a score, never a forecast.
 */

import { auditFindings, type Finding, type ReviewContext, type ReviewInput, type Severity } from "@/lib/seo-review/audit";
import { demandSummary, type Evidence } from "@/lib/seo-review/evidence";
import { classifyIntent, keywordIdeas, keywordOverlaps, relevance } from "@/lib/seo-review/keyword";
import { outfitOccasions } from "@/lib/types";

export const READINESS_DISCLAIMER = "Content readiness measures this page against the checklist. It is not a prediction of Google traffic or rankings.";

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export type Readiness = { passed: number; total: number; percent: number; blockers: number; disclaimer: string };

export function readiness(findings: Finding[]): Readiness {
  const total = findings.length;
  const passed = findings.filter((f) => f.ok).length;
  return {
    passed,
    total,
    percent: total ? Math.round((passed / total) * 100) : 0,
    blockers: findings.filter((f) => f.kind === "blocker" && !f.ok).length,
    disclaimer: READINESS_DISCLAIMER,
  };
}

/** Everything about one keyword: intent, fit with this look, overlap, and recorded demand. */
export function analyseKeyword(keyword: string, input: ReviewInput, context: ReviewContext, evidence: Evidence[] = []) {
  const look = { celebrity: input.celebrity, event: input.event, occasions: outfitOccasions(input), items: input.items };
  return {
    keyword,
    intent: classifyIntent(keyword, input.celebrity),
    relevance: relevance(keyword, look),
    overlaps: keywordOverlaps(keyword, context.others, context.id),
    demand: demandSummary(evidence, context.today),
  };
}

export function buildReview(input: ReviewInput, context: ReviewContext, primaryEvidence: Evidence[] = []) {
  const findings = auditFindings(input, context);
  const sorted = (list: Finding[]) => [...list].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const keyword = input.primaryKeyword?.trim();
  return {
    readiness: readiness(findings),
    blockers: sorted(findings.filter((f) => f.kind === "blocker" && !f.ok)),
    recommendations: sorted(findings.filter((f) => f.kind === "editorial" && !f.ok)),
    passed: findings.filter((f) => f.ok),
    primary: keyword ? analyseKeyword(keyword, input, context, primaryEvidence) : null,
    ideas: keywordIdeas({ ...outfitFacts(input), leadPieceId: input.leadPieceId }),
  };
}

const outfitFacts = (input: ReviewInput) => ({ celebrity: input.celebrity, event: input.event, occasions: outfitOccasions(input), items: input.items });

export type Review = ReturnType<typeof buildReview>;
