import type { Metadata } from "next";
import { CorrectionsPage } from "@/components/editorial/CorrectionsPage";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";

export const metadata: Metadata = {
  title: "Corrections",
  description:
    "Our corrections policy and the full log of errors we have published and fixed, kept in the open rather than edited away.",
  alternates: { canonical: "/corrections" },
};

export default function Page() {
  return (
    <>
      <Nav />
      <CorrectionsPage />
      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
