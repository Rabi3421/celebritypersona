import type { Metadata } from "next";
import { CorrectionsPage } from "@/components/editorial/CorrectionsPage";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Corrections Policy & Log",
  description: "Our corrections policy and the full log of errors we have published and fixed, kept in the open rather than edited away.",
  path: "/corrections",
});

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
