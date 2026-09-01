import type { Metadata } from "next";
import { BudgetExplorer } from "@/components/budget/BudgetExplorer";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { getOutfits } from "@/lib/db/content";

export const metadata:Metadata={title:"Shop by Budget — Celebrity looks you can actually afford",description:"Set your budget and discover complete celebrity-inspired outfits with every piece priced and linked."};

/** `?budget=` lets the homepage tiles open the slider where you clicked
 *  instead of dropping everyone at the same default. */
export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ budget?: string }> }) {
  const [outfits, query] = await Promise.all([getOutfits(), searchParams]);
  const requested = Number(query.budget);
  const initialBudget = Number.isFinite(requested) && requested > 0 ? requested : undefined;
return <><Nav active="budget"/><BudgetExplorer outfits={outfits} initialBudget={initialBudget}/><Footer/><MobileTabs/><ScrollEffects/></>;}
