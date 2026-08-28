import Image from "next/image";
import Link from "next/link";
import { occasions, occasionSlug, type Occasion, type OccasionGroup } from "@/lib/occasions-content";
import styles from "@/app/occasions/occasions.module.css";

const inr = new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:0 });
const calendar = [
  {name:"Ganesh Chaturthi",date:"14 Sep 2026",days:17,looks:24,slug:"diwali"},
  {name:"Navratri",date:"11 Oct 2026",days:44,looks:31,slug:"navratri"},
  {name:"Durga Puja",date:"17 Oct 2026",days:50,looks:19,slug:"diwali"},
  {name:"Karwa Chauth",date:"29 Oct 2026",days:62,looks:22,slug:"karwa-chauth"},
  {name:"Diwali",date:"8 Nov 2026",days:72,looks:41,slug:"diwali"},
  {name:"Wedding season",date:"From 15 Nov 2026",days:79,looks:218,slug:"sangeet"},
];

export function OccasionsDirectory() {
  return <main className={styles.page}>
    <header className={styles.band}><div className={styles.shell}><nav className={styles.crumb}><Link href="/">Home</Link><i>›</i><span>Occasions</span></nav><h1>What are you<br/>dressing for?</h1><p>Most people don&apos;t browse by celebrity — they browse by the thing in their calendar. Start with the event, we&apos;ll show you what to wear and what it costs.</p></div></header>
    <section className={styles.calendar}><div className={styles.shell}><div className={styles.calendarHeading}><span>◆ Coming up</span><i/><small>Dates approximate</small></div><div className={styles.calendarRail}>{calendar.map((event)=><Link href={`/occasions/${event.slug}`} className={event.days<=45?styles.soon:""} key={event.name}><div><span><h2>{event.name}</h2><small>{event.date}</small></span><i style={{"--progress":`${Math.max(8,100-event.days/1.2)}%`} as React.CSSProperties}><b>{event.days}</b><small>days</small></i></div><p><span>Looks ready</span><b>{event.looks}</b></p></Link>)}</div></div></section>
    <div className={styles.shell}>
      <section className={styles.section}><div className={styles.weddingFeature}><div><p>Peak season · November to February</p><h2>Wedding season is coming</h2><span>Sangeet, mehendi, haldi, reception — the five events everyone panics about. All decoded, all with swaps you can order in time.</span></div><strong>79<small>Days until season starts</small></strong></div><GroupSection group="Wedding" eyebrow="The five" title="Wedding occasions" body="Ranked by how many looks we've decoded for each." /></section>
      <GroupSection group="Festival" eyebrow="Around the year" title="Festival looks" body="Dressing for the dates that actually move the needle in India." section />
      <GroupSection group="Everyday" eyebrow="The rest of the time" title="Everyday and events" body="Airport looks are the most-searched category on this site by a wide margin." section />
      <section className={styles.planner}><div><h2>Got an event in the diary?</h2><p>Save looks into a collection for it. We&apos;ll nudge you when something new lands that fits — and warn you if a piece is about to sell out.</p></div><button type="button">Start a collection →</button></section>
    </div>
  </main>;
}

function GroupSection({group,eyebrow,title,body,section=false}:{group:OccasionGroup;eyebrow:string;title:string;body:string;section?:boolean}){
  const items=occasions.filter((occasion)=>occasion.group===group);
  return <section className={section?styles.section:""}><div className={styles.sectionHeading}><div><p>{eyebrow}</p><h2>{title}</h2><span>{body}</span></div><b>{items.reduce((sum,item)=>sum+item.looks,0)} looks total</b></div><div className={`${styles.tiles} ${group==="Everyday"?styles.four:""}`}>{items.map((occasion)=><OccasionTile occasion={occasion} key={occasion.id}/>)}</div></section>;
}

function OccasionTile({occasion}:{occasion:Occasion}){
  return <Link href={`/occasions/${occasionSlug(occasion)}`} className={styles.tile}><Image src={`https://picsum.photos/seed/cpocc${occasion.id}/500/667`} alt={`${occasion.name} looks`} fill sizes="(max-width:1023px) 50vw, 20vw"/><span className={occasion.peak.includes("days")?styles.now:""}>{occasion.peak}</span><em>from {inr.format(occasion.swapFrom)}</em><div><h3>{occasion.name}</h3><p>{occasion.looks} looks · swaps from {inr.format(occasion.swapFrom)}</p><section>{[0,1,2,3].map((value)=><Image key={value} src={`https://picsum.photos/seed/cpp${occasion.id}${value}/80/104`} alt="" width={34} height={44}/>)}</section></div></Link>;
}
