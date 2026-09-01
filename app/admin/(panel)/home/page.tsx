import { HomeForm, type HomeComputed } from "@/components/admin/HomeForm";
import { archiveTotals, brandRoll, budgetTiers, dupeOfTheWeek, heroLook } from "@/lib/archive";
import { getHomeContent, getOutfits } from "@/lib/db/content";
import { inr } from "@/lib/format";

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const [home, outfits, { saved }] = await Promise.all([
    getHomeContent(),
    getOutfits(),
    searchParams,
  ]);

  // The homepage used to ask an editor for all of this. It is shown here as a
  // readout so the panel still answers "what does the site say about itself?".
  const totals = archiveTotals(outfits);
  const tiers = budgetTiers(outfits);
  const hero = heroLook(outfits);
  const dupe = dupeOfTheWeek(outfits);

  const computed: HomeComputed = [
    { label: "Stats bar", value: `${totals.looks} looks · ${totals.pieces} pieces`, hint: totals.averageSavingPct === null ? "No look priced on both sides yet" : `${totals.averageSavingPct}% average saving` },
    { label: "Budget tiles", value: tiers.length ? tiers.map((tier) => inr(tier.cap)).join(" · ") : "—", hint: tiers.length ? tiers.map((tier) => `${tier.looks} looks`).join(" · ") : "No complete look yet" },
    { label: "Swap demo", value: hero ? `${hero.celebrity} · ${hero.event}` : "—", hint: hero ? `${hero.items.length} pieces priced on both sides` : "Needs a look with two sides priced" },
    { label: "Dupe of the week", value: dupe ? `${dupe.worn.brand} → ${dupe.swap.brand}` : "—", hint: dupe ? `${inr(dupe.worn.price)} → ${inr(dupe.swap.price)}` : "No comparable piece yet" },
    { label: "Brand marquee", value: `${brandRoll(outfits).length} labels`, hint: "Worn labels and swap retailers, interleaved" },
    { label: "Ticker & tiles", value: `${totals.celebrities} archives · ${totals.occasions} occasions`, hint: "Ranked by looks decoded" },
  ];

  return <HomeForm home={home} computed={computed} saved={saved === "1"} />;
}
