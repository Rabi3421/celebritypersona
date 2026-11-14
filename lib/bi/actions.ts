/**
 * The Founder Action Center: what needs doing, worked out from records only.
 *
 * Each action carries what it is, why it matters, the evidence (counts and
 * the looks behind them), a priority, how sure we are, the next step and
 * where to do it. Nothing is estimated: an action exists only because a
 * stored field or a connected source says so.
 *
 * Status history (new / ongoing / resolved) needs a record of past runs,
 * which does not exist yet, so actions describe the data as it is now.
 */

import type { HealthCheck } from "@/lib/admin-health";
import type { ClickSummary } from "@/lib/bi/clicks";
import type { ContentSnapshot, LookRef } from "@/lib/bi/content";

export type Priority = "high" | "medium" | "low";
export type Area = "Shopping" | "Search" | "Content" | "Readers" | "Data";
export type Action = {
  id: string;
  area: Area;
  priority: Priority;
  /** high: read straight from a stored field; medium: an inference from one. */
  confidence: "high" | "medium";
  title: string;
  why: string;
  evidence: string;
  /** Up to three specific places to start. */
  examples: { label: string; href: string }[];
  next: string;
  href: string;
  hrefLabel: string;
};

const RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const EXAMPLES = 3;
const edit = (look: LookRef) => ({ label: look.name, href: `/admin/outfits/${look.id}` });
const unique = <T extends { href: string }>(rows: T[]) => [...new Map(rows.map((r) => [r.href, r])).values()];
const s = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

export function buildActions(input: {
  content: ContentSnapshot;
  health: HealthCheck[];
  clicks: ClickSummary | null;
  /** From configuration alone, so the actions never wait on PostHog. */
  traffic: { configured: true } | { configured: false; reason: string };
  periodLabel: string;
}): Action[] {
  const { content, health, clicks, traffic, periodLabel } = input;
  const { links, search, looks } = content;
  const actions: Action[] = [];

  if (links.problems.length) {
    const live = links.problems.filter((l) => l.live).length;
    // Verified demand on the affected looks: production clicks this period
    // (from the top-looks list, so a floor, never an estimate).
    const affected = new Set(links.problems.map((l) => l.id));
    const demand = (clicks?.topOutfits ?? []).filter((o) => o.id !== null && affected.has(o.id)).reduce((n, o) => n + o.clicks, 0);
    const demandNote = demand ? ` Those looks received ${s(demand, "production shop click")} in ${periodLabel.toLowerCase()}.` : "";
    actions.push({
      id: "broken-links",
      area: "Shopping",
      priority: "high",
      confidence: "high",
      title: `Replace ${s(links.problems.length, "sold-out or dead shop link")}`,
      why: "A shopper who clicks Buy lands on a page that cannot sell them the piece — the click is spent and the trust with it.",
      evidence: `${s(links.problems.length, "link")} marked ${[links.byStatus.sold_out && `sold out (${links.byStatus.sold_out})`, links.byStatus.dead && `dead (${links.byStatus.dead})`].filter(Boolean).join(" and ")}; ${live} on live looks.${demandNote}`,
      examples: unique(links.problems.map((l) => ({ label: `${l.piece} (${l.side}) — ${l.name}`, href: `/admin/outfits/${l.id}` }))).slice(0, EXAMPLES),
      next: "Find the piece in stock elsewhere, or mark the original sold out and give it a swap.",
      href: "/admin/revenue",
      hrefLabel: "Open link issues",
    });
  }

  if (search.withoutKeyword.length) {
    actions.push({
      id: "no-keyword",
      area: "Search",
      priority: "high",
      confidence: "high",
      title: `Set a primary keyword on ${s(search.withoutKeyword.length, "live look")}`,
      why: "The SEO checklist scores a look's title, description and copy against its primary keyword. Without one, there is nothing to check a page against.",
      evidence: `${search.withoutKeyword.length} of ${search.live} live looks have no primary keyword.`,
      examples: search.withoutKeyword.slice(0, EXAMPLES).map(edit),
      next: "Open each look, run the SEO research assistant and save a primary keyword.",
      href: "/admin/outfits",
      hrefLabel: "All outfits",
    });
  }

  if (looks.heldBack) {
    actions.push({
      id: "held-back",
      area: "Content",
      priority: "medium",
      confidence: "high",
      title: `${s(looks.heldBack, "look")} saved but not live`,
      why: "Not a draft, but with no worn price and no swap, so no public page shows it.",
      evidence: `${looks.heldBack} saved as ready but held back by the site's live test.`,
      examples: content.heldBackList.slice(0, EXAMPLES).map(edit),
      next: "Add a worn price or a swap so it goes live, or set it back to draft.",
      href: "/admin/outfits",
      hrefLabel: "All outfits",
    });
  }

  if (links.unverified.length) {
    actions.push({
      id: "unverified-links",
      area: "Shopping",
      priority: "medium",
      confidence: "high",
      title: `Verify ${s(links.unverified.length, "shop link")}`,
      why: "An unverified link has never been confirmed to reach the product it names.",
      evidence: `${links.byStatus.unverified} unverified and ${links.byStatus.pending} pending, out of ${links.total} links.`,
      examples: unique(links.unverified.map((l) => ({ label: `${l.piece} (${l.side}) — ${l.name}`, href: `/admin/outfits/${l.id}` }))).slice(0, EXAMPLES),
      next: "Open the link, confirm the product and price, and set its status in the editor.",
      href: "/admin/outfits",
      hrefLabel: "All outfits",
    });
  }

  const unchecked = links.neverChecked.length + links.stale.length;
  if (unchecked) {
    actions.push({
      id: "link-checks",
      area: "Shopping",
      priority: "medium",
      confidence: "high",
      title: `Re-check ${s(unchecked, "link")} not checked in ${links.staleDays} days`,
      why: "Retail pages move and sell out. A link last checked a month ago may already be dead.",
      evidence: `${links.neverChecked.length} never checked; ${links.stale.length} last checked over ${links.staleDays} days ago.`,
      examples: unique([...links.neverChecked, ...links.stale].map((l) => ({ label: `${l.piece} (${l.side}) — ${l.name}`, href: `/admin/outfits/${l.id}` }))).slice(0, EXAMPLES),
      next: "Run the link checker, or confirm each link by hand in the editor.",
      href: "/admin/outfits",
      hrefLabel: "All outfits",
    });
  }

  if (links.total > 0 && links.affiliate === 0) {
    const clickNote = clicks ? ` ${s(clicks.current.total, "production shop click")} in ${periodLabel.toLowerCase()} went to unmonetised links.` : "";
    actions.push({
      id: "no-affiliate",
      area: "Shopping",
      priority: "medium",
      confidence: "high",
      title: "No shop link earns yet",
      why: "Every click goes to a plain retailer URL. Until links carry an affiliate URL, traffic cannot turn into commission.",
      evidence: `0 of ${links.total} links carry an affiliate URL.${clickNote}`,
      examples: (clicks?.topOutfits ?? []).filter((o) => o.id !== null).slice(0, EXAMPLES).map((o) => ({ label: `Most-clicked: ${o.slug || `look ${o.id}`}`, href: `/admin/outfits/${o.id}` })),
      next: "Once an affiliate programme approves the site, start with the most-clicked looks.",
      href: "/admin/revenue",
      hrefLabel: "Open Revenue",
    });
  }

  const titleGaps = Math.max(search.withoutTitle, search.withoutDescription);
  if (titleGaps) {
    actions.push({
      id: "seo-fields",
      area: "Search",
      priority: "medium",
      confidence: "high",
      title: "Fill missing SEO titles and descriptions",
      why: "Without them the page falls back to a generated title and description, which may not say what a searcher typed.",
      evidence: `${search.withoutTitle} live looks have no SEO title; ${search.withoutDescription} have no SEO description.`,
      examples: [],
      next: "Write both in the outfit editor's SEO panel.",
      href: "/admin/outfits",
      hrefLabel: "All outfits",
    });
  }

  for (const check of health.filter((c) => !c.ok)) {
    const readers = check.key === "reports" || check.key === "requests";
    actions.push({
      id: `health-${check.key}`,
      area: readers ? "Readers" : "Content",
      priority: readers ? "medium" : "low",
      confidence: "high",
      title: `${check.label} — ${check.count}`,
      why: check.detail,
      evidence: `${check.count} found by the archive health check.`,
      examples: [],
      next: "Open the filtered list and work through it.",
      href: check.href,
      hrefLabel: "Open the list",
    });
  }

  if (looks.drafts) {
    actions.push({
      id: "drafts",
      area: "Content",
      priority: "low",
      confidence: "high",
      title: `${s(looks.drafts, "draft")} waiting`,
      why: "Drafts are work already started; finishing one is the cheapest way to add a page.",
      evidence: `${looks.drafts} saved as draft.`,
      examples: content.draftList.slice(0, EXAMPLES).map(edit),
      next: "Finish and publish, or delete what will not be finished.",
      href: "/admin/outfits",
      hrefLabel: "All outfits",
    });
  }

  if (content.publishing.withoutDate) {
    actions.push({
      id: "no-published-date",
      area: "Data",
      priority: "low",
      confidence: "high",
      title: `${s(content.publishing.withoutDate, "live look")} with no first-published date`,
      why: "They went live before publish dates were recorded, so they are missing from 'published in period' counts.",
      evidence: `${content.publishing.withDate} of ${search.live} live looks have a publish date.`,
      examples: [],
      next: "Nothing urgent. Publishing counts are complete only for looks published since the date was introduced.",
      href: "/admin/outfits",
      hrefLabel: "All outfits",
    });
  }

  if (!traffic.configured) {
    actions.push({
      id: "posthog",
      area: "Data",
      priority: "medium",
      confidence: "high",
      title: "Connect traffic data to this dashboard",
      why: "Page views and outfit views come from PostHog. Without them, the dashboard cannot show what readers look at.",
      evidence: traffic.reason,
      examples: [],
      next: "Add a read-only PostHog key (Query Read scope) and the project id to the site's environment.",
      href: "#sources",
      hrefLabel: "See data sources",
    });
  }

  actions.push({
    id: "gsc",
    area: "Data",
    priority: "medium",
    confidence: "high",
    title: "Connect Google Search Console",
    why: "Search is how a style archive gets found. Without Search Console there are no Google clicks, impressions, queries or positions here.",
    evidence: "No Search Console connection exists in the site or the monitor.",
    examples: [],
    next: "Approve a read-only Search Console integration (proposed separately).",
    href: "#search",
    hrefLabel: "See Search",
  });

  if (clicks && clicks.excluded.unclassified > 0) {
    actions.push({
      id: "untagged-clicks",
      area: "Data",
      priority: "low",
      confidence: "high",
      title: `${s(clicks.excluded.unclassified, "click")} without an environment tag`,
      why: "Recorded before clicks were tagged by environment, so they cannot be told apart from test clicks. They are left out of every total.",
      evidence: `${clicks.excluded.unclassified} untagged in ${periodLabel.toLowerCase()}.`,
      examples: [],
      next: "Nothing to do. They age out of the dashboard's periods on their own.",
      href: "#commerce",
      hrefLabel: "See shop clicks",
    });
  }

  return actions.sort((a, b) => RANK[a.priority] - RANK[b.priority]);
}
