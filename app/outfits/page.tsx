import type { Metadata } from "next";
import { OutfitsExplorer } from "@/components/outfits/OutfitsExplorer";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";

export const metadata: Metadata = {
  title: "All Outfits — Decoded with prices and buy links",
  description:
    "Explore celebrity outfits decoded piece by piece, with original prices, affordable swaps, and filters for occasion, celebrity, and budget.",
};

export default function OutfitsPage() {
  return (
    <>
      <Nav active="outfits" />
      <OutfitsExplorer />
      <Footer />
      <MobileTabs active="outfits" />
      <ScrollEffects />
    </>
  );
}
