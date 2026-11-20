import { HomeStudio, type StudioFacts } from "@/components/admin/home/HomeStudio";
import { archiveTotals, brandRoll, budgetTiers, dupeOfTheWeek, heroLook, homeStats, looksInGroup } from "@/lib/archive";
import { getHomeContent, getOccasions, getPublishedOutfits } from "@/lib/db/content";
import { inr } from "@/lib/format";
import { MIN_WEDDING_LOOKS } from "@/lib/thresholds";

/**
 * Homepage Studio: the editorial copy on the public homepage, with a live
 * preview, and a readout of everything the homepage counts for itself.
 *
 * The figures come from published looks only — the same set the public
 * homepage reads — so they match what a visitor sees. (This readout used to
 * count drafts as well, and could name a draft as the dupe of the week.)
 */
export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const [home, outfits, occasions, { saved }] = await Promise.all([
    getHomeContent(),
    getPublishedOutfits(),
    getOccasions(),
    searchParams,
  ]);

  const totals = archiveTotals(outfits);
  const tiers = budgetTiers(outfits);
  const hero = heroLook(outfits);
  const dupe = dupeOfTheWeek(outfits);
  const brands = brandRoll(outfits).length;

  const facts: StudioFacts = {
    publishedLooks: outfits.length,
    automatic: [
      { key: "stats", label: "Figures", value: `${totals.looks} looks · ${totals.pieces} pieces`, hint: totals.averageSavingPct === null ? "No look priced on both sides yet" : `${totals.averageSavingPct}% average saving`, live: true },
      { key: "budget", label: "Budget tiles", value: tiers.length ? tiers.map((tier) => inr(tier.cap)).join(" · ") : "Not shown yet", hint: tiers.length ? tiers.map((tier) => `${tier.looks} looks`).join(" · ") : "Needs a complete look", live: tiers.length > 0 },
      { key: "swap", label: "Swap demo", value: hero ? `${hero.celebrity} · ${hero.event}` : "Not shown yet", hint: hero ? `${hero.items.length} pieces priced on both sides` : "Needs a look with two pieces priced on both sides", live: Boolean(hero) },
      { key: "dupe", label: "Dupe of the week", value: dupe ? `${dupe.worn.brand} → ${dupe.swap.brand}` : "Not shown yet", hint: dupe ? `${inr(dupe.worn.price)} → ${inr(dupe.swap.price)}` : "Needs a piece priced on both sides", live: Boolean(dupe) },
      { key: "brands", label: "Brand marquee", value: `${brands} ${brands === 1 ? "label" : "labels"}`, hint: "Worn labels and swap retailers, interleaved", live: brands > 0 },
      { key: "ticker", label: "Ticker and tiles", value: `${totals.celebrities} celebrities · ${totals.occasions} occasions`, hint: "Ranked by looks decoded", live: totals.looks > 0 },
    ],
    counters: homeStats(outfits).map((stat) => ({ label: stat.label, value: `${stat.value.toLocaleString("en-IN")}${stat.suffix}` })),
    weddingLooks: looksInGroup(occasions, outfits, "Wedding").length,
    minWeddingLooks: MIN_WEDDING_LOOKS,
    swapDemo: hero ? `${hero.celebrity} · ${hero.event}` : null,
  };

  return <HomeStudio home={home} facts={facts} saved={saved === "1"} />;
}
