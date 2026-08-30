"use client";
import Image from "next/image";
import Link from "next/link";
import {useMemo,useState,type CSSProperties,type ReactNode} from "react";
import { outfitOccasions } from "@/lib/filters";
import { outfitSlug } from "@/lib/slugs";
import type { Outfit } from "@/lib/types";
import styles from "@/app/budget/budget.module.css";
import { outfitPhoto, isFullySwapped } from "@/lib/types";

const inr=new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0});
const kits=[
 {max:2000,items:[["👗","Kurta set","Libas",1199],["👡","Juttis","Mochi",400],["💍","Jhumkas","Zaveri",299]]},
 {max:3500,items:[["👗","Printed lehenga","Libas",1799],["👡","Embellished flats","Mochi",649],["💍","Statement earrings","Zaveri",441],["👜","Potli bag","Accessorize",299]]},
 {max:6000,items:[["👗","Worked lehenga","Myntra",2899],["👡","Heels","Mochi",899],["💍","Kundan set","Zaveri",1221],["👜","Clutch","Accessorize",699],["🕶️","Sunglasses","Lenskart",282]]},
 {max:11000,items:[["👗","Designer-diffusion lehenga","Nykaa",5490],["👡","Embroidered juttis","Mochi",1199],["💍","Polki set","Tanishq",2150],["👜","Structured clutch","Westside",899],["🧣","Silk dupatta","Fabindia",762]]},
 {max:99999,items:[["👗","Raw silk lehenga","Nykaa",7890],["👡","Block heels","Mochi",1899],["💍","Temple jewellery set","Tanishq",3200],["👜","Beaded clutch","Accessorize",1299],["🧣","Banarasi dupatta","Fabindia",1512]]},
] as const;
const tierCollections: Array<{value:number;body:string}> = [
 {value:2000,body:"High-street pieces that read right from a few feet away. Best for casual and airport."},
 {value:5000,body:"The sweet spot. Better fabric, real embroidery, and most wedding events."},
 {value:10000,body:"Designer-diffusion territory. Reception and red carpet looks become possible."},
];

export function BudgetExplorer({ outfits }: { outfits: Outfit[] }){
 const [budget,setBudget]=useState(3000);const [saved,setSaved]=useState<number[]>([]);
 const eligible=useMemo(()=>outfits.filter(isFullySwapped).filter((outfit)=>outfit.swap<=budget).sort((a,b)=>b.worn-a.worn),[outfits,budget]);
 const occasions=useMemo(()=>Object.fromEntries(outfitOccasions.map((occasion)=>[occasion,eligible.filter((outfit)=>outfit.occasion===occasion).length])),[eligible]);
 const kit=kits.find((item)=>budget<=item.max)??kits[kits.length-1];const kitTotal=kit.items.reduce((sum,item)=>sum+item[3],0);const maxOccasion=Math.max(1,...Object.values(occasions));
 const biggestGap=eligible[0]?.worn;const progress=(budget-1000)/14000*100;
 return <main className={styles.page}>
  <header className={styles.dial}><div className={styles.shell}><nav><Link href="/">Home</Link><i>›</i><span>Budget</span></nav><h1>Everyone else starts with the celebrity.<br/>Start with your wallet.</h1><p>Set what you&apos;re willing to spend on a complete look. We&apos;ll show you exactly which ones you can copy.</p><div className={styles.knob}><div><p className={styles.amount}><span>₹</span>{budget.toLocaleString("en-IN")}</p><div className={styles.slider}><input type="range" min="1000" max="15000" step="250" value={budget} style={{"--progress":`${progress}%`} as CSSProperties} onChange={(event)=>setBudget(Number(event.target.value))} aria-label="Your budget"/><div><span>₹1,000</span><span>₹15,000</span></div></div><div className={styles.presets}>{[2000,3000,5000,10000,15000].map((value)=><button type="button" aria-pressed={budget===value} onClick={()=>setBudget(value)} key={value}>{value===15000?"No limit":inr.format(value)}</button>)}</div></div><div className={styles.readout}><p><span>Complete looks you can copy</span><b>{eligible.length}</b></p><p><span>Occasions covered</span><b>{Object.values(occasions).filter(Boolean).length} of {outfitOccasions.length}</b></p><p><span>Cheapest complete look</span><b>{eligible.length?inr.format(Math.min(...eligible.map((outfit)=>outfit.swap))):"—"}</b></p><div><span>◆ The biggest gap at this budget</span><p>You can copy a look that originally cost<b>{biggestGap?compactPrice(biggestGap):"—"}</b></p></div></div></div></div></header>
  <div className={styles.shell}>
   <section className={styles.section}><SectionHeading eyebrow="Reality check" title={<>What <em>{inr.format(budget)}</em> actually buys</>} body="A real complete look from the archive at this budget — every piece, priced."/><div className={styles.reality}><div className={styles.kit}><h3>Example complete look</h3><ul>{kit.items.map((item)=><li key={item[1]}><span>{item[0]}</span><p><b>{item[1]}</b><small>{item[2]}</small></p><em>{inr.format(item[3])}</em></li>)}</ul><div><span>Total</span><b>{inr.format(kitTotal)}</b></div></div><div className={styles.occasionBars}><h3>Looks available by occasion</h3>{outfitOccasions.map((occasion)=><div key={occasion}><p><span>{occasion}</span><b className={occasions[occasion]?"":styles.zero}>{occasions[occasion]?`${occasions[occasion]} look${occasions[occasion]>1?"s":""}`:"none yet"}</b></p><i><b style={{width:`${occasions[occasion]/maxOccasion*100}%`}}/></i></div>)}</div></div></section>
   <section className={styles.section}><SectionHeading eyebrow="In range" title="Looks you can afford" total={`${eligible.length} looks in range`}/>{eligible.length?<div className={styles.grid}>{eligible.slice(0,12).map((outfit)=><BudgetCard outfit={outfit} budget={budget} saved={saved.includes(outfit.id)} onSave={()=>setSaved(saved.includes(outfit.id)?saved.filter((id)=>id!==outfit.id):[...saved,outfit.id])} key={outfit.id}/>)}</div>:<div className={styles.empty}><h3>Nothing at {inr.format(budget)} yet</h3><p>Our cheapest complete look is {inr.format(Math.min(...outfits.map((outfit)=>outfit.swap)))}. Nudge the slider up a little.</p><button type="button" onClick={()=>setBudget(1500)}>Show me ₹1,500 looks</button></div>}</section>
   <section className={styles.section}><SectionHeading eyebrow="Or jump straight in" title="Budget collections"/><div className={styles.tiers}>{tierCollections.map(({value,body})=><button type="button" onClick={()=>{setBudget(value);window.scrollTo({top:0,behavior:"smooth"});}} key={value}><span>Complete looks under</span><b>{inr.format(value)}</b><p>{body}</p><em>Browse →</em></button>)}</div></section>
  </div>
 </main>;
}

function SectionHeading({eyebrow,title,body,total}:{eyebrow:string;title:ReactNode;body?:string;total?:string}){return <div className={styles.sectionHeading}><div><p>{eyebrow}</p><h2>{title}</h2>{body&&<span>{body}</span>}</div>{total&&<b>{total}</b>}</div>;}
function compactPrice(value:number){return value>=100000?`${(value/100000).toFixed(1).replace(/\.0$/,"")} lakh`:inr.format(value);}
function BudgetCard({outfit,budget,saved,onSave}:{outfit:Outfit;budget:number;saved:boolean;onSave:()=>void}){return <article className={styles.card}><Link href={`/outfits/${outfitSlug(outfit)}`}><div><Image src={outfitPhoto(outfit)?.url ?? `https://picsum.photos/seed/cpo${outfit.id}/600/750`} alt={`${outfit.celebrity} ${outfit.occasion} look`} fill sizes="(max-width:520px) 50vw, 25vw"/><span>{outfit.occasion}</span><b>fits {inr.format(budget)}</b></div><section><h3>{outfit.celebrity}</h3><p>{outfit.event}</p><span><s>{inr.format(outfit.worn)}</s><b>{inr.format(outfit.swap)}</b></span></section></Link><button type="button" aria-pressed={saved} onClick={onSave}>{saved?"♥":"♡"}</button></article>;}
