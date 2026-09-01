import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OccasionDetail } from "@/components/occasions/OccasionDetail";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { occasionSlug } from "@/lib/slugs";
import { outfitsForOccasion } from "@/lib/archive";
import { getOccasionBySlug, getOccasionViews, getOutfits } from "@/lib/db/content";

type Props={params:Promise<{slug:string}>};
// Records added in the admin panel render on demand instead of 404ing
// until the next build.
export const dynamicParams = true;
export async function generateStaticParams(){const occasions=await getOccasionViews();return occasions.map((occasion)=>({slug:occasionSlug(occasion)}));}
export async function generateMetadata({params}:Props):Promise<Metadata>{const {slug}=await params;const occasion=await getOccasionBySlug(slug);if(!occasion)return{};const {looks,swapFrom}=occasion.stats;const from=swapFrom===null?"":` from ₹${swapFrom.toLocaleString("en-IN")}`;return{title:`${occasion.name} Outfits — Celebrity looks and affordable swaps`,description:`Explore ${looks} decoded ${occasion.name.toLowerCase()} ${looks===1?"look":"looks"}, what to wear, original prices, and affordable swaps${from}.`};}
export default async function OccasionPage({params}:Props){const {slug}=await params;const [occasion,outfits,occasions]=await Promise.all([getOccasionBySlug(slug),getOutfits(),getOccasionViews()]);if(!occasion)notFound();const archive=outfitsForOccasion(outfits,occasion.name);const related=occasions.filter((item)=>item.id!==occasion.id&&item.group===occasion.group).slice(0,4);return <><Nav active="occasions"/><OccasionDetail occasion={occasion} outfits={archive} related={related}/><Footer/><MobileTabs active="occasions"/><ScrollEffects/></>;}
