import Image from "next/image";
import Link from "next/link";
import { occasionSlug } from "@/lib/slugs";
import type { OccasionGroup } from "@/lib/types";
import type { OccasionView } from "@/lib/archive";
import { upcomingOccasions } from "@/lib/archive";
import styles from "@/app/occasions/occasions.module.css";
import { getOccasionViews } from "@/lib/db/content";

const inr = new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:0 });
const dateFmt = new Intl.DateTimeFormat("en-IN", { day:"numeric", month:"short", year:"numeric" });

/** How soon an event has to be for its card to read as urgent. */
const SOON_DAYS = 45;

const formatDate = (value?: string) =>
  value ? dateFmt.format(new Date(`${value}T00:00:00`)) : "";

/** A photo from a look in this group, so a tile shows the occasion rather than
 *  a placeholder seed. */
const tilePhoto = (occasion: OccasionView, index = 0) =>
  occasion.stats.photos[index] ??
  occasion.stats.photos[0] ??
  `https://picsum.photos/seed/cpocc${occasion.id}/500/667`;

/**
 * Everything counted here — the countdowns, the looks-ready figures, the group
 * totals and the cheapest swap on each tile — is read off the outfits and the
 * dates an editor set. The rail used to be six festivals hardcoded in this
 * file, complete with look counts nothing stood behind.
 */
export async function OccasionsDirectory() {
  const occasions = await getOccasionViews();
  const upcoming = upcomingOccasions(occasions);
  const nextWedding = upcoming.find((occasion) => occasion.group === "Wedding");

  return <main className={styles.page}>
    <header className={styles.band}><div className={styles.shell}><nav className={styles.crumb}><Link href="/">Home</Link><i>›</i><span>Occasions</span></nav><h1>What are you<br/>dressing for?</h1><p>Most people don&apos;t browse by celebrity — they browse by the thing in their calendar. Start with the event, we&apos;ll show you what to wear and what it costs.</p></div></header>
    {upcoming.length ? <section className={styles.calendar}><div className={styles.shell}><div className={styles.calendarHeading}><span>◆ Coming up</span><i/><small>Dates approximate</small></div><div className={styles.calendarRail}>{upcoming.map((event)=><Link href={`/occasions/${occasionSlug(event)}`} className={(event.daysAway ?? 0)<=SOON_DAYS?styles.soon:""} key={event.id}><div><span><h2>{event.name}</h2><small>{formatDate(event.nextDate)}</small></span><i style={{"--progress":`${Math.max(8,100-(event.daysAway ?? 0)/1.2)}%`} as React.CSSProperties}><b>{event.daysAway}</b><small>days</small></i></div><p><span>Looks ready</span><b>{event.stats.looks}</b></p></Link>)}</div></div></section> : null}
    <div className={styles.shell}>
      <section className={styles.section}>{nextWedding ? <div className={styles.weddingFeature}><div><p>{nextWedding.peak}</p><h2>Wedding season is coming</h2><span>Sangeet, mehendi, haldi, reception — the five events everyone panics about. All decoded, all with swaps you can order in time.</span></div><strong>{nextWedding.daysAway}<small>Days until season starts</small></strong></div> : null}<GroupSection occasions={occasions} group="Wedding" eyebrow="The five" title="Wedding occasions" body="Ranked by how many looks we've decoded for each." /></section>
      <GroupSection occasions={occasions} group="Festival" eyebrow="Around the year" title="Festival looks" body="Dressing for the dates that actually move the needle in India." section />
      <GroupSection occasions={occasions} group="Everyday" eyebrow="The rest of the time" title="Everyday and events" body="Airport looks are the most-searched category on this site by a wide margin." section />
      <section className={styles.planner}><div><h2>Got an event in the diary?</h2><p>Tap the heart on any look and it is kept in this browser, ready to compare side by side with what the whole outfit would cost to rebuild.</p></div><Link href="/saved">Open your saved looks →</Link></section>
    </div>
  </main>;
}

function GroupSection({occasions,group,eyebrow,title,body,section=false}:{occasions:OccasionView[];group:OccasionGroup;eyebrow:string;title:string;body:string;section?:boolean}){
  const items=occasions.filter((occasion)=>occasion.group===group);
  if(items.length===0) return null;
  const total=items.reduce((sum,item)=>sum+item.stats.looks,0);
  return <section className={section?styles.section:""}><div className={styles.sectionHeading}><div><p>{eyebrow}</p><h2>{title}</h2><span>{body}</span></div><b>{total} {total===1?"look":"looks"} total</b></div><div className={`${styles.tiles} ${group==="Everyday"?styles.four:""}`}>{items.map((occasion)=><OccasionTile occasion={occasion} key={occasion.id}/>)}</div></section>;
}

function OccasionTile({occasion}:{occasion:OccasionView}){
  const {looks,swapFrom}=occasion.stats;
  // The countdown wins over the editorial peak line once a date is in range.
  const soon=occasion.daysAway!==null&&occasion.daysAway<=SOON_DAYS;
  const badge=soon?`In ${occasion.daysAway} days`:occasion.peak;
  return <Link href={`/occasions/${occasionSlug(occasion)}`} className={styles.tile}><Image src={tilePhoto(occasion)} alt={`${occasion.name} looks`} fill sizes="(max-width:1023px) 50vw, 20vw"/>{badge?<span className={soon?styles.now:""}>{badge}</span>:null}{swapFrom!==null?<em>from {inr.format(swapFrom)}</em>:null}<div><h3>{occasion.name}</h3><p>{looks} {looks===1?"look":"looks"}{swapFrom!==null?` · swaps from ${inr.format(swapFrom)}`:""}</p><section>{[0,1,2,3].map((value)=><Image key={value} src={tilePhoto(occasion,value)} alt="" width={34} height={44}/>)}</section></div></Link>;
}
