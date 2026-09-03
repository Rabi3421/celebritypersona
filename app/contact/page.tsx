import type { Metadata } from "next";
import { ContactPage } from "@/components/editorial/ContactPage";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact CelebrityPersona",
  description: "How to reach CelebrityPersona about a wrong price, a correction, copyright, your personal data, or a partnership, plus our published Grievance Officer.",
  path: "/contact",
});

export default function Page() {
  return (
    <>
      <Nav />
      <ContactPage />
      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
