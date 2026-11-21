import { z } from "zod";
import { researchSchema, type LookResearch } from "@/lib/look-research";

/**
 * The second opinion on a look's research.
 *
 * Claude researches the look; Codex, working separately with its own web
 * search, then checks every fact Claude relied on. Codex never writes the page.
 * What it disputes is handed to the editor as a check and the fact loses its
 * confidence, so a disagreement can only make a draft more cautious, never
 * more confident. Where Codex agrees, its sources are added to the fact's own.
 *
 * Codex's reply is untrusted input like Claude's: checked here before use.
 * No imports beyond zod and the research rules, so the runner and tests load it.
 */

export const CROSSCHECK_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdicts", "problems"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "verdict", "note", "sources"],
        properties: {
          claim: { type: "string" },
          verdict: { type: "string", enum: ["agrees", "disagrees", "cannot_check"] },
          note: { type: "string" },
          sources: { type: "array", items: { type: "string" } },
        },
      },
    },
    problems: { type: "array", items: { type: "string" } },
  },
} as const;

const link = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  });

export const crosscheckSchema = z.object({
  verdicts: z
    .array(
      z.object({
        claim: z.string().trim().min(1).max(300),
        verdict: z.enum(["agrees", "disagrees", "cannot_check"]),
        note: z.string().trim().max(400),
        // A bad link is dropped, not a reason to throw the whole check away.
        sources: z.array(z.string()).max(10).transform((list) => list.filter((url) => link.safeParse(url).success).slice(0, 3)),
      }),
    )
    .max(40),
  problems: z.array(z.string().trim().min(5).max(300)).max(10),
});

export type Crosscheck = z.output<typeof crosscheckSchema>;

const MAX_CHECKS = 20;
const MAX_SOURCES = 5;
const clip = (text: string, size = 300) => (text.length > size ? `${text.slice(0, size - 1)}…` : text);
const same = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Folds Codex's verdicts into Claude's research. Disputed facts drop to
 * "unverified" and become checks; agreed facts gain Codex's sources; what Codex
 * could not check changes nothing. The result passes `researchSchema` or the
 * research comes back unchanged with one check saying the merge failed.
 */
export function mergeCrosscheck(research: LookResearch, check: Crosscheck): { research: LookResearch; disputed: number; agreed: number } {
  let disputed = 0;
  let agreed = 0;
  const added: string[] = [];

  const evidence = research.evidence.map((fact) => {
    const verdict = check.verdicts.find((item) => same(item.claim, fact.claim));
    if (!verdict) return fact;
    if (verdict.verdict === "disagrees") {
      disputed++;
      const where = verdict.sources[0] ? ` (${verdict.sources[0]})` : "";
      added.push(clip(`Codex disputes "${clip(fact.claim, 120)}": ${verdict.note || "no reason given"}${where}`));
      return { ...fact, confidence: "unverified" as const, sources: [...new Set([...fact.sources, ...verdict.sources])].slice(0, MAX_SOURCES) };
    }
    if (verdict.verdict === "agrees") {
      agreed++;
      return { ...fact, sources: [...new Set([...fact.sources, ...verdict.sources])].slice(0, MAX_SOURCES) };
    }
    return fact;
  });

  for (const problem of check.problems) added.push(clip(`Codex: ${problem}`));

  // Disputes first: they matter more than anything already on the list.
  const checks = [...added, ...research.checks].slice(0, MAX_CHECKS);
  const merged = researchSchema.safeParse({ ...research, evidence, checks });
  if (!merged.success) {
    return {
      research: { ...research, checks: [...research.checks, "The Codex cross-check could not be merged; check the facts by hand."].slice(0, MAX_CHECKS) },
      disputed: 0,
      agreed: 0,
    };
  }
  return { research: merged.data, disputed, agreed };
}

/** Adds one check, keeping the list within its limit. */
export function withCheck(research: LookResearch, check: string): LookResearch {
  return { ...research, checks: [...research.checks.slice(0, MAX_CHECKS - 1), clip(check)] };
}
