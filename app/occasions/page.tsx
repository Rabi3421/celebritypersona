import type { Metadata } from "next";
import { OccasionsDirectory } from "@/components/occasions/OccasionsDirectory";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";

export const metadata: Metadata = {
  title: "Browse by Occasion — Wedding, festival and everyday looks",
  description: "Browse celebrity looks by occasion, with every piece priced and affordable swaps for weddings, festivals, airports, red carpets, and more.",
};

export default function OccasionsPage() {
  return <><Nav active="occasions" /><OccasionsDirectory /><Footer /><MobileTabs active="occasions" /><ScrollEffects /></>;
}
