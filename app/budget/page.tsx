import type { Metadata } from "next";
import { BudgetExplorer } from "@/components/budget/BudgetExplorer";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { getOutfits } from "@/lib/db/content";

export const metadata:Metadata={title:"Shop by Budget — Celebrity looks you can actually afford",description:"Set your budget and discover complete celebrity-inspired outfits with every piece priced and linked."};
export default async function BudgetPage() {
  const outfits = await getOutfits();
return <><Nav active="budget"/><BudgetExplorer outfits={outfits}/><Footer/><MobileTabs/><ScrollEffects/></>;}
