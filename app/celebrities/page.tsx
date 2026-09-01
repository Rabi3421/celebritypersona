import type { Metadata } from "next";
import { CelebrityDirectory } from "@/components/celebrities/CelebrityDirectory";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { archiveTotals } from "@/lib/archive";
import { getCelebrityViews, getOutfits } from "@/lib/db/content";

export const metadata: Metadata = {
  title: "Celebrity Style Archives — Every look decoded",
  description: "Browse Indian celebrity style archives with outfits decoded piece by piece, original prices, and affordable swaps.",
};

export default async function CelebritiesPage() {
  const [celebrities, outfits] = await Promise.all([getCelebrityViews(), getOutfits()]);

  return (
    <>
      <Nav active="celebrities" />
      <CelebrityDirectory celebrities={celebrities} totals={archiveTotals(outfits)} />
      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
