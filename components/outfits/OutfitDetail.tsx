"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { outfitSlug, type Outfit } from "@/lib/outfits-content";
import styles from "@/app/outfits/[slug]/outfit-detail.module.css";

type PriceMode = "worn" | "swap";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const longDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function OutfitDetail({
  outfit,
  sameCelebrity,
  sameOccasion,
}: {
  outfit: Outfit;
  sameCelebrity: Outfit[];
  sameOccasion: Outfit[];
}) {
  const [mode, setMode] = useState<PriceMode>("worn");
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [mobileBarVisible, setMobileBarVisible] = useState(false);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const published = new Date(`${outfit.date}T00:00:00`);
  const percentage = Math.round((1 - outfit.swap / outfit.worn) * 1000) / 10;

  useEffect(() => {
    const target = ctaRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setMobileBarVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  function selectMode(nextMode: PriceMode) {
    setMode(nextMode);
  }

  function jumpToItem(index: number) {
    setHighlighted(index);
    document.getElementById(`outfit-item-${index}`)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    });
    window.setTimeout(() => setHighlighted(null), 1400);
  }

  function handleCta() {
    if (mode === "worn") setMode("swap");
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.crumb} aria-label="Breadcrumb">
          <Link href="/">Home</Link><i>›</i>
          <Link href="/outfits">Outfits</Link><i>›</i>
          <span>{outfit.celebrity}</span><i>›</i>
          <span>{outfit.event}</span>
        </nav>

        <div className={styles.split}>
          <div className={styles.photoColumn}>
            <figure className={styles.frame}>
              <Image
                src={`https://picsum.photos/seed/cpo${outfit.id}/900/1125`}
                alt={`${outfit.celebrity} at ${outfit.event}`}
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 58vw"
              />
              <figcaption>Photo · Editorial archive</figcaption>
              <span className={styles.hint}>Tap a dot</span>
              {outfit.items.map((item, index) => (
                <button
                  type="button"
                  className={styles.hotspot}
                  style={{ left: `${[47, 70, 50, 52][index % 4]}%`, top: `${[38, 56, 86, 15][index % 4]}%` }}
                  key={item.name}
                  aria-label={`Jump to ${item.name}`}
                  onClick={() => jumpToItem(index)}
                >{index + 1}</button>
              ))}
            </figure>
          </div>

          <div className={styles.ledger}>
            <header className={styles.title}>
              <p>Decoded · {outfit.items.length} pieces</p>
              <h1>{outfit.celebrity} at {outfit.event}</h1>
              <div>{longDate.format(published)} · <Link href={`/occasions/${outfit.occasion.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{outfit.occasion} looks</Link> · <Link href={`/celebrities/${outfit.celebrity.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{outfit.celebrity} archive</Link></div>
            </header>

            <div className={`${styles.toggle} ${mode === "swap" ? styles.swapMode : ""}`} role="tablist" aria-label="Price mode">
              <i />
              <button type="button" role="tab" aria-selected={mode === "worn"} onClick={() => selectMode("worn")}>As worn</button>
              <button type="button" role="tab" aria-selected={mode === "swap"} onClick={() => selectMode("swap")}>The swap</button>
            </div>

            <div className={styles.lines}>
              {outfit.items.map((item, index) => (
                <article id={`outfit-item-${index}`} className={`${styles.line} ${highlighted === index ? styles.highlighted : ""}`} key={item.name}>
                  <div>
                    <h2>{item.name}</h2>
                    <p>{mode === "worn" ? item.wornBrand : item.swapBrand}</p>
                    <span className={`${styles.stockTag} ${mode === "worn" && index === 1 ? styles.archived : ""}`}>
                      {mode === "swap" ? "Similar · in stock" : index === 1 ? "Archive · not sold" : index === 2 ? "Exact · low stock" : "Exact · in stock"}
                    </span>
                  </div>
                  <div className={styles.linePrice}>
                    <b>{inr.format(mode === "worn" ? item.worn : item.swap)}</b>
                    <button type="button" disabled={mode === "worn" && index === 1}>Buy</button>
                  </div>
                </article>
              ))}
            </div>

            <div className={styles.total}>
              <span>{mode === "worn" ? "Total as worn" : "Total for the swap"}</span>
              <b aria-live="polite">{inr.format(mode === "worn" ? outfit.worn : outfit.swap)}</b>
            </div>
            <div className={styles.purchaseBox}>
              <p>◷ Prices checked 2 days ago</p>
              {mode === "swap" && <div>You save {inr.format(outfit.worn - outfit.swap)} — {percentage}% less</div>}
              <button ref={ctaRef} type="button" onClick={handleCta}>
                {mode === "swap" ? `Buy all ${outfit.items.length} pieces · ${inr.format(outfit.swap)}` : `Get this look for ${inr.format(outfit.swap)}`}
              </button>
              <small>We earn a commission on some links. It never changes what we pick or what you pay.</small>
            </div>
          </div>
        </div>

        <RelatedRail title={`More from ${outfit.celebrity}`} outfits={sameCelebrity} />
        <RelatedRail title={`More ${outfit.occasion.toLowerCase()} looks`} outfits={sameOccasion} />

        <div className={styles.byline}>
          <div className={styles.authorAvatar}>R</div>
          <div><p>Decoded by Rabi</p><span>Published {shortDate.format(published)} · Prices re-checked 2 days ago</span></div>
          <button type="button">Report a wrong price</button>
        </div>
      </div>

      <div className={`${styles.mobileBar} ${mobileBarVisible ? styles.mobileBarVisible : ""}`}>
        <button type="button" onClick={handleCta}>
          {mode === "swap" ? `Buy all ${outfit.items.length} pieces · ${inr.format(outfit.swap)}` : `Get this look for ${inr.format(outfit.swap)}`}
        </button>
      </div>
    </main>
  );
}

function RelatedRail({ title, outfits }: { title: string; outfits: Outfit[] }) {
  if (!outfits.length) return null;

  return (
    <section className={styles.related}>
      <div className={styles.relatedHeading}>
        <h2>{title}</h2><Link href="/outfits">View all →</Link>
      </div>
      <div className={styles.relatedRail}>
        {outfits.map((outfit) => (
          <Link className={styles.relatedCard} href={`/outfits/${outfitSlug(outfit)}`} key={outfit.id}>
            <div><Image src={`https://picsum.photos/seed/cpo${outfit.id}/380/475`} alt="" fill sizes="220px" /></div>
            <section>
              <h3>{outfit.celebrity}</h3>
              <p>{outfit.event} · {shortDate.format(new Date(`${outfit.date}T00:00:00`))}</p>
              <span><s>{inr.format(outfit.worn)}</s><b>{inr.format(outfit.swap)}</b></span>
            </section>
          </Link>
        ))}
      </div>
    </section>
  );
}
