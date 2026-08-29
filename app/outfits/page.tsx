import type { Metadata } from "next";
import { OutfitsExplorer } from "@/components/outfits/OutfitsExplorer";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { getOutfits } from "@/lib/db/content";

export const metadata: Metadata = {
  title: "All Outfits — Decoded with prices and buy links",
  description:
    "Explore celebrity outfits decoded piece by piece, with original prices, affordable swaps, and filters for occasion, celebrity, and budget.",
};

export default async function OutfitsPage() {
  const outfits = await getOutfits();

  return (
    <>
      <Nav active="outfits" />
      <OutfitsExplorer outfits={outfits} />
      <Footer />
      <MobileTabs active="outfits" />
      <ScrollEffects />
    </>
  );
}
