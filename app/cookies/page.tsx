import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { getLegalDoc } from "@/lib/legal-content";

const doc = getLegalDoc("cookies");

export const metadata: Metadata = doc
  ? {
      title: doc.title,
      description: doc.description,
      alternates: { canonical: "/cookies" },
    }
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
