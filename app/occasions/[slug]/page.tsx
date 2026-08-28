import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OccasionDetail } from "@/components/occasions/OccasionDetail";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { getOccasionBySlug, occasionSlug, occasions } from "@/lib/occasions-content";
import { outfits } from "@/lib/outfits-content";

type Props={params:Promise<{slug:string}>};
export const dynamicParams=false;
export function generateStaticParams(){return occasions.map((occasion)=>({slug:occasionSlug(occasion)}));}
export async function generateMetadata({params}:Props):Promise<Metadata>{const {slug}=await params;const occasion=getOccasionBySlug(slug);if(!occasion)return{};return{title:`${occasion.name} Outfits — Celebrity looks and affordable swaps`,description:`Explore ${occasion.looks} decoded ${occasion.name.toLowerCase()} looks, what to wear, original prices, and affordable swaps from ₹${occasion.swapFrom.toLocaleString("en-IN")}.`};}
export default async function OccasionPage({params}:Props){const {slug}=await params;const occasion=getOccasionBySlug(slug);if(!occasion)notFound();const archive=outfits.filter((outfit)=>outfit.occasion.toLowerCase()===occasion.name.toLowerCase());const related=occasions.filter((item)=>item.id!==occasion.id&&item.group===occasion.group).slice(0,4);return <><Nav active="occasions"/><OccasionDetail occasion={occasion} outfits={archive} related={related}/><Footer/><MobileTabs active="occasions"/><ScrollEffects/></>;}
