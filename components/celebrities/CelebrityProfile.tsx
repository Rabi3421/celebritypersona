"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { celebrityBio } from "@/lib/celebrity-bio";
import { celebritySlug, outfitSlug } from "@/lib/slugs";
import { useSavedList } from "@/lib/saved";
import { outfitPhoto, pricing } from "@/lib/types";
import type { Outfit } from "@/lib/types";
import type { CelebrityView } from "@/lib/archive";
import styles from "@/app/celebrities/[slug]/celebrity-profile.module.css";

type SortMode = "new" | "saving" | "cheap" | "lux";
const inr = new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:0 });
const shortDate = new Intl.DateTimeFormat("en-IN", { day:"numeric", month:"short", year:"2-digit" });
const longDate = new Intl.DateTimeFormat("en-IN", { day:"numeric", month:"short", year:"numeric" });

function saving(outfit: Outfit) { return outfit.worn > 0 ? Math.round((1 - outfit.swap / outfit.worn) * 100) : 0; }
function formatDay(value: string | null) { return value ? longDate.format(new Date(`${value}T00:00:00`)) : null; }

/** "3 days ago" only once there is a day to count from. */
function agoLabel(value: string | null) {
  if (!value) return "No looks yet";
  const days = Math.round((Date.now() - Date.parse(`${value}T00:00:00`)) / 86_400_000);
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  return `Updated ${days} days ago`;
}

export function CelebrityProfile({ celebrity, outfits, similar }: { celebrity: CelebrityView; outfits: Outfit[]; similar: CelebrityView[] }) {
  // Both lists live in the browser, shared with the header badge and /saved.
  const saved = useSavedList("looks");
  const followed = useSavedList("people");
  const [occasion, setOccasion] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("new");
  const bio = celebrityBio(celebrity);
  const stats = celebrity.stats;
  const checked = formatDay(stats.lastChecked);
  const isFollowed = followed.has(celebritySlug(celebrity));

  const results = useMemo(() => {
    const filtered = outfits.filter((outfit) => !occasion || outfit.occasion === occasion);
    return filtered.sort((a, b) => {
      if (sort === "saving") return b.worn - b.swap - (a.worn - a.swap);
      if (sort === "cheap") return a.swap - b.swap;
      if (sort === "lux") return b.worn - a.worn;
      return b.date.localeCompare(a.date);
    });
  }, [occasion, outfits, sort]);

  // Her cheapest and priciest look, taken from the looks themselves rather
  // than from two figures typed into the record.
  const priced = outfits.filter((outfit) => pricing(outfit).anyPriced);
  const affordable = priced.length ? [...priced].sort((a,b) => a.worn - b.worn)[0] : null;
  const expensive = priced.length ? [...priced].sort((a,b) => b.worn - a.worn)[0] : null;
  // Real counts: how often each label actually appears across her pieces.
  const brandCounts = stats.brands.slice(0, 4);
  const topBrandCount = brandCounts[0]?.count ?? 1;
  const portrait = (index = 0) => stats.photos[index] ?? stats.photos[0] ?? `https://picsum.photos/seed/cpc${celebrity.id}/700/875`;

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.shell}>
          <nav className={styles.crumb} aria-label="Breadcrumb"><Link href="/">Home</Link><i>›</i><Link href="/celebrities">Celebrities</Link><i>›</i><span>{celebrity.name}</span></nav>
          <div className={styles.heroInner}>
            <figure className={styles.portrait}>
              <Image src={portrait()} alt={celebrity.name} fill priority sizes="(max-width:1023px) 220px, 340px" />
              <span>{stats.looks} looks</span>
            </figure>
            <div className={styles.heroCopy}>
              <h1>{celebrity.name}</h1><p className={styles.subtitle}>Style archive · {agoLabel(stats.lastDecoded)}</p>
              {bio.map((paragraph) => <p className={styles.bio} key={paragraph}>{paragraph}</p>)}
              <p className={styles.byline}>Written by <b>Rabi</b>{checked ? <> · Prices re-checked <b>{checked}</b></> : null} · <Link href={`/report-a-price?piece=${encodeURIComponent(celebrity.name)}`}>Report a correction</Link></p>
              <div className={styles.heroStats}>
                <div><b>{stats.looks}</b><span>Looks decoded</span></div><div><b>{stats.pieces}</b><span>Pieces identified</span></div>
                {stats.averageSaving === null ? null : <div><b className={styles.green}>{stats.averageSaving}%</b><span>Avg saving</span></div>}
                {stats.low === null || stats.high === null ? null : <div><b>{compactPrice(stats.low)}–{compactPrice(stats.high)}</b><span>Typical range</span></div>}
              </div>
              <div className={styles.actions}>
                <button type="button" aria-pressed={isFollowed} onClick={() => followed.toggle(celebritySlug(celebrity))}>{isFollowed ? `✓ Following ${firstName(celebrity.name)}` : `♡ Follow ${firstName(celebrity.name)}`}</button>
                <button type="button">Get her looks on WhatsApp</button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {stats.looks === 0 ? null : (
      <section className={styles.signature}>
        <div className={styles.shell}>
          <SectionHeading eyebrow="The pattern" title="What she actually wears" body={`Counted across all ${stats.looks} decoded ${stats.looks === 1 ? "look" : "looks"} — not an impression, the actual tally.`} />
          <div className={styles.signatureGrid}>
            <div className={styles.bars}><h3>Most repeated labels</h3>{brandCounts.map((item) => <div className={styles.bar} key={item.name}><p><span>{item.name}<em>{item.highStreet ? "High street" : "Designer"}</em></span><b>{item.count}×</b></p><i><b style={{ width:`${Math.round(item.count / topBrandCount * 100)}%` }} /></i></div>)}</div>
            <div className={styles.patternPanel}>
              {stats.palette.length === 0 ? null : <div><h3>Palette she returns to</h3><div className={styles.palette}>{stats.palette.map((colour) => <span key={colour.name}><i style={{background:colour.value}} /><small>{colour.name}</small></span>)}</div></div>}
              {stats.garments.length === 0 ? null : <div><h3>Silhouettes she goes to</h3><p className={styles.tags}>{stats.garments.map((garment) => <span key={garment.name}>{garment.name}</span>)}</p></div>}
              {stats.low === null || stats.high === null ? null : <div><h3>What her looks cost</h3><div className={styles.range}><span>Cheapest</span><span>Priciest</span><i><b /></i><strong>{inr.format(stats.low)}</strong><strong>{inr.format(stats.high)}</strong></div></div>}
            </div>
          </div>
        </div>
      </section>
      )}

      {affordable && expensive && affordable.id !== expensive.id ? (
      <section className={styles.extremes}>
        <div className={styles.shell}><SectionHeading eyebrow="The range" title="Her cheapest look, and her priciest" />
          <div className={styles.extremeGrid}>
            <ExtremeCard outfit={affordable} label="Most affordable" />
            <span>VS</span>
            <ExtremeCard outfit={expensive} label="Most expensive" />
          </div>
        </div>
      </section>
      ) : null}

      <section className={styles.archive}>
        <div className={styles.shell}><SectionHeading eyebrow="The archive" title="Every look, newest first" />
          <div className={styles.archiveBar}>
            <div><button type="button" aria-pressed={!occasion} onClick={() => setOccasion(null)}>All <b>{outfits.length}</b></button>{stats.occasions.map((entry) => <button type="button" aria-pressed={occasion === entry.name} onClick={() => setOccasion(entry.name)} key={entry.name}>{entry.name} <b>{entry.count}</b></button>)}</div>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} aria-label="Sort looks"><option value="new">Newest</option><option value="saving">Biggest saving</option><option value="cheap">Cheapest swap</option><option value="lux">Priciest worn</option></select>
          </div>
          {results.length ? <div className={styles.outfitGrid}>{results.map((outfit) => <ProfileOutfitCard outfit={outfit} saved={saved.has(outfitSlug(outfit))} onSave={() => saved.toggle(outfitSlug(outfit))} key={outfit.id} />)}</div> : <div className={styles.empty}><h3>{occasion ? `No ${occasion.toLowerCase()} looks in this archive yet` : "Nothing decoded here yet"}</h3><p>Looks published in the panel appear here the moment they are saved.</p>{occasion && <button type="button" onClick={() => setOccasion(null)}>Show all</button>}</div>}
        </div>
      </section>

      {similar.length ? <section className={styles.similar}><div className={styles.shell}><SectionHeading eyebrow="Nearby" title="Similar style archives" /><div className={styles.similarGrid}>{similar.map((item) => <Link href={`/celebrities/${celebritySlug(item)}`} key={item.id}><Image src={item.stats.photos[0] ?? `https://picsum.photos/seed/cpc${item.id}/160/160`} alt="" width={78} height={78} /><b>{item.name}</b><span>{item.stats.looks} looks</span></Link>)}</div></div></section> : null}
    </main>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow:string; title:string; body?:string }) { return <div className={styles.sectionHeading}><p>{eyebrow}</p><h2>{title}</h2>{body && <span>{body}</span>}</div>; }
function firstName(name:string){ return name.split(" ")[0]; }
function compactPrice(value:number){ return value >= 100000 ? `₹${(value/100000).toFixed(1).replace(/\.0$/,"")}L` : `₹${Math.round(value/1000)}k`; }

/** Both ends of the range are real looks now, so the card always links
 *  somewhere and never quotes a price the archive cannot show you. */
function ExtremeCard({ outfit, label }: { outfit:Outfit; label:string }) {
  const money = pricing(outfit);
  return <Link className={styles.extremeCard} href={`/outfits/${outfitSlug(outfit)}`}><div><Image src={outfitPhoto(outfit)?.url ?? `https://picsum.photos/seed/cpo${outfit.id}/800/500`} alt="" fill sizes="(max-width:1023px) 100vw, 45vw" /></div><section><p>{label} · {outfit.event}</p><h3>{outfit.items.map((item)=>item.name).slice(0,2).join(" and ")}</h3><span><s>{inr.format(money.wornTotal)}</s>{money.anySwapped ? <b>{inr.format(money.swapTotal)}</b> : null}</span></section></Link>;
}

function ProfileOutfitCard({ outfit, saved, onSave }: { outfit:Outfit; saved:boolean; onSave:()=>void }) {
  return <article className={styles.outfitCard}><Link href={`/outfits/${outfitSlug(outfit)}`}><div><Image src={outfitPhoto(outfit)?.url ?? `https://picsum.photos/seed/cpo${outfit.id}/600/750`} alt={`${outfit.celebrity} at ${outfit.event}`} fill sizes="(max-width:560px) 50vw, 25vw" /><span>{shortDate.format(new Date(`${outfit.date}T00:00:00`))}</span><em>{outfit.occasion}</em><b>−{saving(outfit)}%</b></div><section><h3>{outfit.event}</h3><p>{outfit.occasion}</p><span><s>{inr.format(outfit.worn)}</s><b>{inr.format(outfit.swap)}</b></span></section></Link><button type="button" aria-pressed={saved} onClick={onSave}>{saved?"♥":"♡"}</button></article>;
}
