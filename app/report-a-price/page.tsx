import type { Metadata } from "next";
import { ReportPricePage } from "@/components/editorial/ReportPricePage";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";

export const metadata: Metadata = {
  title: "Report a Price",
  description:
    "Spotted a price that has changed or a link that has died? Report it here and we will check it against the retailer, usually the same day.",
  alternates: { canonical: "/report-a-price" },
};

export default function Page() {
  return (
    <>
      <Nav />
      <ReportPricePage />
      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
