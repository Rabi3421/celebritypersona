import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { getLegalDoc } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/seo";

const doc = getLegalDoc("cookies");

export const metadata: Metadata = doc
  ? pageMetadata({
      title: doc.title,
      description: doc.description,
      path: "/cookies",
    })
  : {};

export default function Page() {
  if (!doc) notFound();
  return (
    <>
      <Nav />
      <LegalDocument doc={doc} />
      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
