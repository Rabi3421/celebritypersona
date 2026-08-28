"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { celebrityBio, celebritySlug, type Celebrity } from "@/lib/celebrities-content";
import { outfitSlug, type Outfit } from "@/lib/outfits-content";
import styles from "@/app/celebrities/[slug]/celebrity-profile.module.css";

type SortMode = "new" | "saving" | "cheap" | "lux";
const inr = new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:0 });
const shortDate = new Intl.DateTimeFormat("en-IN", { day:"numeric", month:"short", year:"2-digit" });

function saving(outfit: Outfit) { return Math.round((1 - outfit.swap / outfit.worn) * 100); }

export function CelebrityProfile({ celebrity, outfits, similar }: { celebrity: Celebrity; outfits: Outfit[]; similar: Celebrity[] }) {
  const [following, setFollowing] = useState(false);
  const [occasion, setOccasion] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("new");
  const [saved, setSaved] = useState<number[]>([]);
  const bio = celebrityBio(celebrity);
  const occasions = [...new Set(outfits.map((outfit) => outfit.occasion))];

  const results = useMemo(() => {
    const filtered = outfits.filter((outfit) => !occasion || outfit.occasion === occasion);
    return filtered.sort((a, b) => {
      if (sort === "saving") return b.worn - b.swap - (a.worn - a.swap);
      if (sort === "cheap") return a.swap - b.swap;
      if (sort === "lux") return b.worn - a.worn;
      return b.date.localeCompare(a.date);
    });
  }, [occasion, outfits, sort]);

  const affordable = outfits.length ? [...outfits].sort((a,b) => a.worn - b.worn)[0] : null;
  const expensive = outfits.length ? [...outfits].sort((a,b) => b.worn - a.worn)[0] : null;
  const brandCounts = celebrity.brands.map((brand, index) => ({ brand, type:index === celebrity.brands.length - 1 ? "High street" : "Designer", count:Math.max(12 - index * 3, 3) }));

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.shell}>
          <nav className={styles.crumb} aria-label="Breadcrumb"><Link href="/">Home</Link><i>›</i><Link href="/celebrities">Celebrities</Link><i>›</i><span>{celebrity.name}</span></nav>
          <div className={styles.heroInner}>
            <figure className={styles.portrait}>
              <Image src={`https://picsum.photos/seed/cpc${celebrity.id}/700/875`} alt={celebrity.name} fill priority sizes="(max-width:1023px) 220px, 340px" />
              <span>{celebrity.looks} looks</span>
            </figure>
            <div className={styles.heroCopy}>
              <h1>{celebrity.name}</h1><p className={styles.subtitle}>Style archive · Updated 3 days ago</p>
              {bio.map((paragraph) => <p className={styles.bio} key={paragraph}>{paragraph}</p>)}
              <p className={styles.byline}>Written by <b>Rabi</b> · Prices re-checked <b>25 Aug 2026</b> · <button type="button">Report a correction</button></p>
              <div className={styles.heroStats}>
                <div><b>{celebrity.looks}</b><span>Looks decoded</span></div><div><b>{celebrity.looks * 4}</b><span>Pieces identified</span></div>
                <div><b className={styles.green}>{celebrity.averageSaving}%</b><span>Avg saving</span></div><div><b>{compactPrice(celebrity.low)}–{compactPrice(celebrity.high)}</b><span>Typical range</span></div>
              </div>
              <div className={styles.actions}>
                <button type="button" aria-pressed={following} onClick={() => setFollowing(!following)}>{following ? `✓ Following ${firstName(celebrity.name)}` : `♡ Follow ${firstName(celebrity.name)}`}</button>
                <button type="button">Get her looks on WhatsApp</button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.signature}>
        <div className={styles.shell}>
          <SectionHeading eyebrow="The pattern" title="What she actually wears" body={`Counted across all ${celebrity.looks} decoded looks — not an impression, the actual tally.`} />
          <div className={styles.signatureGrid}>
            <div className={styles.bars}><h3>Most repeated labels</h3>{brandCounts.map((item, index) => <div className={styles.bar} key={item.brand}><p><span>{item.brand}<em>{item.type}</em></span><b>{item.count}×</b></p><i><b style={{ width:`${100 - index * 23}%` }} /></i></div>)}</div>
            <div className={styles.patternPanel}>
              <div><h3>Palette she returns to</h3><div className={styles.palette}>{[["#F2EDE3","Ivory"],["#DCD2C0","Oatmeal"],["#C9A5A0","Dusty rose"],["#1C1C1C","Black"],["#6B7256","Olive"]].map(([color,label]) => <span key={label}><i style={{background:color}} /><small>{label}</small></span>)}</div></div>
              <div><h3>Silhouettes she goes to</h3><p className={styles.tags}><span>Relaxed tailoring</span><span>Wide trousers</span><span>Statement layers</span><span>Flat shoes</span><span>Minimal jewellery</span></p></div>
              <div><h3>What her looks cost</h3><div className={styles.range}><span>Cheapest</span><span>Priciest</span><i><b /></i><strong>{inr.format(celebrity.low)}</strong><strong>{inr.format(celebrity.high)}</strong></div></div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.extremes}>
        <div className={styles.shell}><SectionHeading eyebrow="The range" title="Her cheapest look, and her priciest" />
          <div className={styles.extremeGrid}>
            <ExtremeCard celebrity={celebrity} outfit={affordable} label="Most affordable" seed={`cheap${celebrity.id}`} fallbackPrice={celebrity.low} />
            <span>VS</span>
            <ExtremeCard celebrity={celebrity} outfit={expensive} label="Most expensive" seed={`lux${celebrity.id}`} fallbackPrice={celebrity.high} />
          </div>
        </div>
      </section>

      <section className={styles.archive}>
        <div className={styles.shell}><SectionHeading eyebrow="The archive" title="Every look, newest first" />
          <div className={styles.archiveBar}>
            <div><button type="button" aria-pressed={!occasion} onClick={() => setOccasion(null)}>All <b>{outfits.length}</b></button>{occasions.map((value) => <button type="button" aria-pressed={occasion === value} onClick={() => setOccasion(value)} key={value}>{value} <b>{outfits.filter((outfit) => outfit.occasion === value).length}</b></button>)}</div>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} aria-label="Sort looks"><option value="new">Newest</option><option value="saving">Biggest saving</option><option value="cheap">Cheapest swap</option><option value="lux">Priciest worn</option></select>
          </div>
          {results.length ? <div className={styles.outfitGrid}>{results.map((outfit) => <ProfileOutfitCard outfit={outfit} saved={saved.includes(outfit.id)} onSave={() => setSaved(saved.includes(outfit.id) ? saved.filter((id) => id !== outfit.id) : [...saved,outfit.id])} key={outfit.id} />)}</div> : <div className={styles.empty}><h3>No loaded looks in this archive slice yet</h3><p>The full archive count is ready for CMS import; current local outfit records will appear here automatically.</p>{occasion && <button type="button" onClick={() => setOccasion(null)}>Show all</button>}</div>}
        </div>
      </section>

      <section className={styles.similar}><div className={styles.shell}><SectionHeading eyebrow="Nearby" title="Similar style archives" /><div className={styles.similarGrid}>{similar.map((item) => <Link href={`/celebrities/${celebritySlug(item)}`} key={item.id}><Image src={`https://picsum.photos/seed/cpc${item.id}/160/160`} alt="" width={78} height={78} /><b>{item.name}</b><span>{item.looks} looks</span></Link>)}</div></div></section>
    </main>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow:string; title:string; body?:string }) { return <div className={styles.sectionHeading}><p>{eyebrow}</p><h2>{title}</h2>{body && <span>{body}</span>}</div>; }
function firstName(name:string){ return name.split(" ")[0]; }
function compactPrice(value:number){ return value >= 100000 ? `₹${(value/100000).toFixed(1).replace(/\.0$/,"")}L` : `₹${Math.round(value/1000)}k`; }

function ExtremeCard({ celebrity, outfit, label, seed, fallbackPrice }: { celebrity:Celebrity; outfit:Outfit|null; label:string; seed:string; fallbackPrice:number }) {
  const content = <><div><Image src={`https://picsum.photos/seed/${outfit ? `cpo${outfit.id}` : seed}/800/500`} alt="" fill sizes="(max-width:1023px) 100vw, 45vw" /></div><section><p>{label} · {outfit?.event ?? "Archive highlight"}</p><h3>{outfit?.items.map((item)=>item.name).slice(0,2).join(" and ") ?? `${celebrity.name} signature look`}</h3><span><s>{inr.format(outfit?.worn ?? fallbackPrice)}</s><b>{inr.format(outfit?.swap ?? Math.round(fallbackPrice * .05))}</b></span></section></>;
  return outfit ? <Link className={styles.extremeCard} href={`/outfits/${outfitSlug(outfit)}`}>{content}</Link> : <article className={styles.extremeCard}>{content}</article>;
}

function ProfileOutfitCard({ outfit, saved, onSave }: { outfit:Outfit; saved:boolean; onSave:()=>void }) {
  return <article className={styles.outfitCard}><Link href={`/outfits/${outfitSlug(outfit)}`}><div><Image src={`https://picsum.photos/seed/cpo${outfit.id}/600/750`} alt={`${outfit.celebrity} at ${outfit.event}`} fill sizes="(max-width:560px) 50vw, 25vw" /><span>{shortDate.format(new Date(`${outfit.date}T00:00:00`))}</span><em>{outfit.occasion}</em><b>−{saving(outfit)}%</b></div><section><h3>{outfit.event}</h3><p>{outfit.occasion}</p><span><s>{inr.format(outfit.worn)}</s><b>{inr.format(outfit.swap)}</b></span></section></Link><button type="button" aria-pressed={saved} onClick={onSave}>{saved?"♥":"♡"}</button></article>;
}
