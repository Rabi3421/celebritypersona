import type { Metadata } from "next";
import { AboutPage } from "@/components/editorial/AboutPage";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";

export const metadata: Metadata = {
  title: "Who We Are",
  description:
    "Indian fashion media tells you what a celebrity spent. CelebrityPersona tells you what you could spend instead. How we started and how we are funded.",
  alternates: { canonical: "/about" },
};

export default function Page() {
  return (
    <>
      <Nav />
      <AboutPage />
      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
