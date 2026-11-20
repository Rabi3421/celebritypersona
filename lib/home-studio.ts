/**
 * The Homepage Studio's logic, apart from React so it can be tested on its own:
 * which sections exist, which of them an edit or a save error belongs to, the
 * small list operations the cards offer, and the guard on what the live
 * preview will accept.
 *
 * Nothing here saves anything: the existing `saveHome` action and
 * `homeContentSchema` remain the only way content reaches the database.
 */

import type { HomeContent } from "@/lib/types";

export type StudioSectionId = "automatic" | "counters" | "steps" | "campaign" | "trust";

/** In the order the public homepage shows them. `automatic` is a readout, never a form. */
export const STUDIO_SECTIONS: { id: StudioSectionId; label: string; description: string; editable: boolean }[] = [
  { id: "automatic", label: "Automatic sections", description: "Counted from published looks", editable: false },
  { id: "counters", label: "Counters", description: "The figures bar under the hero", editable: true },
  { id: "steps", label: "How swaps work", description: "The steps beside the swap demo", editable: true },
  { id: "campaign", label: "Campaign band", description: "The wedding-season band", editable: true },
  { id: "trust", label: "Trust points", description: "How we decode a look", editable: true },
];

/** The section a validation error key (from `fieldErrors`) belongs to; null for form-wide messages. */
export function sectionOfError(key: string): StudioSectionId | null {
  if (key === "showStats") return "counters";
  if (key === "swapSteps" || key.startsWith("swapSteps.")) return "steps";
  if (key === "campaign" || key.startsWith("campaign.")) return "campaign";
  if (key === "trustPoints" || key.startsWith("trustPoints.")) return "trust";
  return null;
}

/** Which sections differ from what is saved. */
export function dirtySections(saved: HomeContent, draft: HomeContent): Set<StudioSectionId> {
  const out = new Set<StudioSectionId>();
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (Boolean(saved.showStats) !== Boolean(draft.showStats)) out.add("counters");
  if (!same(saved.swapSteps, draft.swapSteps)) out.add("steps");
  if (!same(saved.campaign, draft.campaign)) out.add("campaign");
  if (!same(saved.trustPoints, draft.trustPoints)) out.add("trust");
  return out;
}

/** The item moved from one position to another; the rest keep their order. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Two-digit numbers in list order: 01, 02, 03 … */
export const sequenceNumber = (index: number) => String(index + 1).padStart(2, "0");

/** Whether the numbers already read 01, 02, 03 … in order. */
export const inSequence = (items: readonly { n: string }[]) => items.every((item, i) => item.n.trim() === sequenceNumber(i));

/** Numbers used by more than one item — the public page keys its list by number. */
export function duplicateNumbers(items: readonly { n: string }[]): string[] {
  const seen = new Map<string, number>();
  for (const item of items) seen.set(item.n.trim(), (seen.get(item.n.trim()) ?? 0) + 1);
  return [...seen.entries()].filter(([n, count]) => n && count > 1).map(([n]) => n);
}

/** The campaign link rule, as the save enforces it (homeContentSchema): a path on this site. */
export const isSitePath = (href: string) => /^\/(?!\/)/.test(href.trim());

export const PREVIEW_MESSAGE = "cp-home-preview";
export const PREVIEW_SIZE_MESSAGE = "cp-home-preview-size";

const MAX_TEXT = 2000;
const MAX_ITEMS = 24;
const text = (value: unknown) => (typeof value === "string" ? value.slice(0, MAX_TEXT) : "");
const items = (value: unknown) =>
  (Array.isArray(value) ? value : []).slice(0, MAX_ITEMS).map((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return { n: text(row.n), title: text(row.title), body: text(row.body) };
  });

/**
 * What the preview frame will render from a message: plain strings only, in
 * the shape the public components expect, capped in size. Anything else is
 * ignored. It is only ever drawn by React (as text), never stored.
 */
export function previewMessage(raw: unknown): { section: StudioSectionId; content: HomeContent } | null {
  if (!raw || typeof raw !== "object") return null;
  const message = raw as Record<string, unknown>;
  if (message.type !== PREVIEW_MESSAGE) return null;
  const section = STUDIO_SECTIONS.find((s) => s.id === message.section)?.id;
  if (!section || !message.content || typeof message.content !== "object") return null;
  const c = message.content as Record<string, unknown>;
  const campaign = c.campaign && typeof c.campaign === "object" ? (c.campaign as Record<string, unknown>) : {};
  return {
    section,
    content: {
      showStats: c.showStats === true,
      swapSteps: items(c.swapSteps),
      trustPoints: items(c.trustPoints),
      campaign: { eyebrow: text(campaign.eyebrow), title: text(campaign.title), body: text(campaign.body), cta: text(campaign.cta), href: text(campaign.href) },
    },
  };
}
