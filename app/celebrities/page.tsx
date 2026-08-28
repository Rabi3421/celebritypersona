import type { Metadata } from "next";
import { CelebrityDirectory } from "@/components/celebrities/CelebrityDirectory";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";

export const metadata: Metadata = {
  title: "Celebrity Style Archives — Every look decoded",
  description: "Browse Indian celebrity style archives with outfits decoded piece by piece, original prices, and affordable swaps.",
};

export default function CelebritiesPage() {
  return (
    <>
      <Nav active="celebrities" />
      <CelebrityDirectory />
      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
