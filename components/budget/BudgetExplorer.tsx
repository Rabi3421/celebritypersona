"use client";
import Image from "next/image";
import Link from "next/link";
import {useMemo,useState,type CSSProperties,type ReactNode} from "react";
import { outfitSlug } from "@/lib/slugs";
import type { Outfit } from "@/lib/types";
import styles from "@/app/budget/budget.module.css";
import { outfitPhoto, isFullySwapped } from "@/lib/types";
import { budgetRange, budgetTiers, exampleKit, occasionCoverage, occasionNames } from "@/lib/archive";

const inr=new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0});

/** What a tier gets you, written from the looks inside it rather than from
 *  three sentences someone typed once. */
function tierBody(looks:number,cheapest:number,occasions:string[]){
 const covers=occasions.length?` Best for ${occasions.slice(0,2).join(" and ").toLowerCase()}.`:"";
 return `${looks} complete ${looks===1?"look":"looks"}, starting at ${inr.format(cheapest)}.${covers}`;
}

export function BudgetExplorer({ outfits, initialBudget }: { outfits: Outfit[]; initialBudget?: number }){
 // Bounds, presets and tiers all follow the cheapest and dearest complete look
 // in the archive, so the slider can never open on a range that buys nothing.
 const range=useMemo(()=>budgetRange(outfits),[outfits]);
 const tiers=useMemo(()=>budgetTiers(outfits),[outfits]);
 const occasionList=useMemo(()=>occasionNames(outfits),[outfits]);
 const [budget,setBudget]=useState(()=>Math.min(range.max,Math.max(range.min,initialBudget??range.presets[0]??range.max)));
 const [saved,setSaved]=useState<number[]>([]);
 const eligible=useMemo(()=>outfits.filter(isFullySwapped).filter((outfit)=>outfit.swap<=budget).sort((a,b)=>b.worn-a.worn),[outfits,budget]);
 const coverage=useMemo(()=>occasionCoverage(outfits,budget),[outfits,budget]);
 const kit=useMemo(()=>exampleKit(outfits,budget),[outfits,budget]);
 const kitTotal=kit?.total??0;const maxOccasion=Math.max(1,...coverage.map((entry)=>entry.looks));
 const biggestGap=eligible[0]?.worn;const progress=(budget-range.min)/Math.max(1,range.max-range.min)*100;
 const cheapestOverall=useMemo(()=>{const totals=outfits.filter(isFullySwapped).map((outfit)=>outfit.swap);return totals.length?Math.min(...totals):null;},[outfits]);
 return <main className={styles.page}>
  <header className={styles.dial}><div className={styles.shell}><nav><Link href="/">Home</Link><i>›</i><span>Budget</span></nav><h1>Everyone else starts with the celebrity.<br/>Start with your wallet.</h1><p>Set what you&apos;re willing to spend on a complete look. We&apos;ll show you exactly which ones you can copy.</p><div className={styles.knob}><div><p className={styles.amount}><span>₹</span>{budget.toLocaleString("en-IN")}</p><div className={styles.slider}><input type="range" min={range.min} max={range.max} step={range.step} value={budget} style={{"--progress":`${progress}%`} as CSSProperties} onChange={(event)=>setBudget(Number(event.target.value))} aria-label="Your budget"/><div><span>{inr.format(range.min)}</span><span>{inr.format(range.max)}</span></div></div><div className={styles.presets}>{range.presets.map((value)=><button type="button" aria-pressed={budget===value} onClick={()=>setBudget(value)} key={value}>{value===range.max?"No limit":inr.format(value)}</button>)}</div></div><div className={styles.readout}><p><span>Complete looks you can copy</span><b>{eligible.length}</b></p><p><span>Occasions covered</span><b>{coverage.filter((entry)=>entry.looks).length} of {occasionList.length}</b></p><p><span>Cheapest complete look</span><b>{eligible.length?inr.format(Math.min(...eligible.map((outfit)=>outfit.swap))):"—"}</b></p><div><span>◆ The biggest gap at this budget</span><p>You can copy a look that originally cost<b>{biggestGap?compactPrice(biggestGap):"—"}</b></p></div></div></div></div></header>
  <div className={styles.shell}>
   <section className={styles.section}><SectionHeading eyebrow="Reality check" title={<>What <em>{inr.format(budget)}</em> actually buys</>} body="A real complete look from the archive at this budget — every piece, priced."/><div className={styles.reality}><div className={styles.kit}><h3>{kit?`${kit.outfit.celebrity} · ${kit.outfit.event}`:"Example complete look"}</h3>{kit?<><ul>{kit.pieces.map((piece)=><li key={piece.name}><span>{piece.emoji}</span><p><b>{piece.name}</b><small>{piece.brand}</small></p><em>{inr.format(piece.price)}</em></li>)}</ul><div><span>Total</span><b>{inr.format(kitTotal)}</b></div></>:<p>Nothing in the archive rebuilds for {inr.format(budget)} yet.</p>}</div><div className={styles.occasionBars}><h3>Looks available by occasion</h3>{coverage.map((entry)=><div key={entry.name}><p><span>{entry.name}</span><b className={entry.looks?"":styles.zero}>{entry.looks?`${entry.looks} look${entry.looks>1?"s":""}`:"none yet"}</b></p><i><b style={{width:`${entry.looks/maxOccasion*100}%`}}/></i></div>)}</div></div></section>
   <section className={styles.section}><SectionHeading eyebrow="In range" title="Looks you can afford" total={`${eligible.length} looks in range`}/>{eligible.length?<div className={styles.grid}>{eligible.slice(0,12).map((outfit)=><BudgetCard outfit={outfit} budget={budget} saved={saved.includes(outfit.id)} onSave={()=>setSaved(saved.includes(outfit.id)?saved.filter((id)=>id!==outfit.id):[...saved,outfit.id])} key={outfit.id}/>)}</div>:<div className={styles.empty}><h3>Nothing at {inr.format(budget)} yet</h3>{cheapestOverall!==null?<><p>Our cheapest complete look is {inr.format(cheapestOverall)}. Nudge the slider up a little.</p><button type="button" onClick={()=>setBudget(Math.min(range.max,Math.max(range.min,cheapestOverall)))}>Show me {inr.format(cheapestOverall)} looks</button></>:<p>No look in the archive has every piece swapped yet. Check back once one does.</p>}</div>}</section>
   {tiers.length?<section className={styles.section}><SectionHeading eyebrow="Or jump straight in" title="Budget collections"/><div className={styles.tiers}>{tiers.map((tier)=><button type="button" onClick={()=>{setBudget(Math.min(range.max,tier.cap));window.scrollTo({top:0,behavior:"smooth"});}} key={tier.cap}><span>Complete looks under</span><b>{inr.format(tier.cap)}</b><p>{tierBody(tier.looks,tier.cheapest,tier.occasions)}</p><em>Browse →</em></button>)}</div></section>:null}
  </div>
 </main>;
}

function SectionHeading({eyebrow,title,body,total}:{eyebrow:string;title:ReactNode;body?:string;total?:string}){return <div className={styles.sectionHeading}><div><p>{eyebrow}</p><h2>{title}</h2>{body&&<span>{body}</span>}</div>{total&&<b>{total}</b>}</div>;}
function compactPrice(value:number){return value>=100000?`${(value/100000).toFixed(1).replace(/\.0$/,"")} lakh`:inr.format(value);}
function BudgetCard({outfit,budget,saved,onSave}:{outfit:Outfit;budget:number;saved:boolean;onSave:()=>void}){return <article className={styles.card}><Link href={`/outfits/${outfitSlug(outfit)}`}><div><Image src={outfitPhoto(outfit)?.url ?? `https://picsum.photos/seed/cpo${outfit.id}/600/750`} alt={`${outfit.celebrity} ${outfit.occasion} look`} fill sizes="(max-width:520px) 50vw, 25vw"/><span>{outfit.occasion}</span><b>fits {inr.format(budget)}</b></div><section><h3>{outfit.celebrity}</h3><p>{outfit.event}</p><span><s>{inr.format(outfit.worn)}</s><b>{inr.format(outfit.swap)}</b></span></section></Link><button type="button" aria-pressed={saved} onClick={onSave}>{saved?"♥":"♡"}</button></article>;}
