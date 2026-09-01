import type { Metadata } from "next";
import { ReportPricePage } from "@/components/editorial/ReportPricePage";
import type { ReportPrefill } from "@/components/editorial/ReportPriceForm";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { getOutfitBySlug } from "@/lib/db/content";
import { PRICE_REPORT_ISSUES, type PriceReportIssue } from "@/lib/types";

export const metadata: Metadata = {
  title: "Report a Price",
  description:
    "Spotted a price that has changed or a link that has died? Report it here and we will check it against the retailer, usually the same day.",
  alternates: { canonical: "/report-a-price" },
};

type Query = { outfit?: string; issue?: string; piece?: string };

const isIssue = (value: string | undefined): value is PriceReportIssue =>
  Boolean(value) && (PRICE_REPORT_ISSUES as readonly string[]).includes(value as string);

/**
 * The outfit pages link here with the look, the piece and the kind of report
 * already chosen, so a reader who spotted something never has to go and find
 * the page address themselves. Anything unrecognised is simply ignored.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const outfit = query.outfit ? await getOutfitBySlug(query.outfit) : undefined;

  const prefill: ReportPrefill | undefined = outfit || isIssue(query.issue) || query.piece
    ? {
        outfit: outfit ? `/outfits/${query.outfit}` : undefined,
        outfitLabel: outfit ? `${outfit.celebrity} — ${outfit.event}` : undefined,
        issue: isIssue(query.issue) ? query.issue : undefined,
        piece: query.piece?.slice(0, 120),
      }
    : undefined;

  return (
    <>
      <Nav />
      <ReportPricePage prefill={prefill} />
      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
