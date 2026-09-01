"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { outfitSlug } from "@/lib/slugs";
import { useSavedList } from "@/lib/saved";
import { outfitPhoto, outfitPhotos, isFullySwapped, pricing } from "@/lib/types";
import type { Outfit } from "@/lib/types";
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
  const [shot, setShot] = useState(0);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const published = new Date(`${outfit.date}T00:00:00`);
  // Was a hardcoded "2 days ago" on every look, whatever the truth.
  const checked = outfit.pricesCheckedAt
    ? new Date(`${outfit.pricesCheckedAt}T00:00:00`)
    : null;
  const money = pricing(outfit);
  // The dots were placed on the cover, so they only belong on the cover.
  const photos = outfitPhotos(outfit);
  const shown = photos[shot];
  const onCover = shot === 0;
  const pieceWord = (count: number) => (count === 1 ? "piece" : "pieces");
  // Reports link back to this exact look, so the reader never has to find its
  // address and the panel always knows which page a correction is about.
  const slug = outfitSlug(outfit);
  const saved = useSavedList("looks");
  const isSaved = saved.has(slug);

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
                src={shown?.url ?? `https://picsum.photos/seed/cpo${outfit.id}/900/1125`}
                alt={`${outfit.celebrity} at ${outfit.event}`}
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 58vw"
              />
              <figcaption>Photo · Editorial archive</figcaption>
              <button
                type="button"
                className={styles.keep}
                aria-pressed={isSaved}
                aria-label={isSaved ? "Remove this look from saved" : "Save this look"}
                onClick={() => saved.toggle(slug)}
              >
                {isSaved ? "♥" : "♡"}
              </button>
              {onCover && outfit.items.some((item) => item.hotspot) ? (
                <span className={styles.hint}>Tap a dot</span>
              ) : null}
              {onCover
                ? outfit.items.map((item, index) =>
                    item.hotspot ? (
                      <button
                        type="button"
                        className={styles.hotspot}
                        style={{ left: `${item.hotspot.x}%`, top: `${item.hotspot.y}%` }}
                        key={item.name}
                        aria-label={`Jump to ${item.name}`}
                        onClick={() => jumpToItem(index)}
                      >
                        {index + 1}
                      </button>
                    ) : null,
                  )
                : null}
            </figure>

            {photos.length > 1 ? (
              <div className={styles.thumbs} role="tablist" aria-label="Photos of this look">
                {photos.map((photo, index) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={index === shot}
                    aria-label={`Photo ${index + 1} of ${photos.length}`}
                    className={index === shot ? `${styles.thumb} ${styles.thumbOn}` : styles.thumb}
                    key={photo.path || photo.url}
                    onClick={() => setShot(index)}
                  >
                    <Image src={photo.url} alt="" fill sizes="90px" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className={styles.ledger}>
            <header className={styles.title}>
              <p>Decoded · {outfit.items.length} {pieceWord(outfit.items.length)}</p>
              <h1>{outfit.celebrity} at {outfit.event}</h1>
              <div>{longDate.format(published)} · <Link href={`/occasions/${outfit.occasion.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{outfit.occasion} looks</Link> · <Link href={`/celebrities/${outfit.celebrity.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{outfit.celebrity} archive</Link></div>
            </header>

            {outfit.notes?.length ? (
              <section className={styles.notes}>
                <h2>About this look</h2>
                {outfit.notes.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            ) : null}

            {money.anySwapped ? (
              <div className={`${styles.toggle} ${mode === "swap" ? styles.swapMode : ""}`} role="tablist" aria-label="Price mode">
                <i />
                <button type="button" role="tab" aria-selected={mode === "worn"} onClick={() => selectMode("worn")}>As worn</button>
                <button type="button" role="tab" aria-selected={mode === "swap"} onClick={() => selectMode("swap")}>The swap</button>
              </div>
            ) : null}

            <div className={styles.lines}>
              {outfit.items.map((item, index) => (
                <article id={`outfit-item-${index}`} className={`${styles.line} ${highlighted === index ? styles.highlighted : ""}`} key={item.name}>
                  <div>
                    <h2>{item.name}</h2>
                    <p>{mode === "worn" ? item.wornBrand : (item.swapBrand ?? "No swap found yet")}</p>
                    <span className={`${styles.stockTag} ${mode === "worn" && !item.wornUrl ? styles.archived : ""}`}>
                      {mode === "swap"
                        ? item.swapBrand
                          ? item.swapUrl
                            ? "Similar · buy it"
                            : "Similar · link pending"
                          : "Still looking"
                        : item.worn === undefined
                          ? "Exact · price unconfirmed"
                          : item.wornUrl
                            ? "Exact · buy it"
                            : "Exact · link pending"}
                    </span>
                    {item.note ? <em className={styles.lineNote}>{item.note}</em> : null}
                  </div>
                  <div className={styles.linePrice}>
                    <b>{(mode === "worn" ? item.worn : item.swap) === undefined
                        ? "—"
                        : inr.format((mode === "worn" ? item.worn : item.swap) as number)}</b>
                    {(mode === "worn" ? item.wornUrl : item.swapUrl) ? (
                      <a
                        href={mode === "worn" ? item.wornUrl : item.swapUrl}
                        target="_blank"
                        rel="nofollow sponsored noopener"
                      >
                        Buy
                      </a>
                    ) : (
                      <button type="button" disabled>
                        Buy
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <div className={styles.total}>
              <span>
                {mode === "worn"
                  ? money.allPriced
                    ? "Total as worn"
                    : money.anyPriced
                      ? `Total for ${money.priced} of ${money.pieces} priced`
                      : "Original prices unconfirmed"
                  : money.allSwapped
                    ? "Total for the swap"
                    : `Total for ${money.swapped} of ${money.pieces} swapped`}
              </span>
              <b aria-live="polite">
                {mode === "worn"
                  ? money.anyPriced ? inr.format(money.wornTotal) : "—"
                  : inr.format(money.swapTotal)}
              </b>
            </div>
            <div className={styles.purchaseBox}>
              <p>◷ {checked ? `Prices checked ${shortDate.format(checked)}` : "Prices not yet re-checked"}</p>

              {money.anySwapped ? (
                <>
                  {mode === "swap" && money.savingPct !== null && (
                    <div>
                      You save {inr.format(money.savingTotal)} — {money.savingPct}% less
                      {money.allSwapped ? "" : ` on ${money.swapped} ${pieceWord(money.swapped)}`}
                    </div>
                  )}
                  <button ref={ctaRef} type="button" onClick={handleCta}>
                    {mode === "swap"
                      ? money.allSwapped
                        ? `Buy all ${money.pieces} ${pieceWord(money.pieces)} · ${inr.format(money.swapTotal)}`
                        : `Buy the ${money.swapped} swapped ${pieceWord(money.swapped)} · ${inr.format(money.swapTotal)}`
                      : money.allSwapped
                        ? `Get this look for ${inr.format(money.swapTotal)}`
                        : `See the ${money.swapped} ${pieceWord(money.swapped)} we have swapped`}
                  </button>
                  <small>
                    {money.allSwapped
                      ? "We earn a commission on some links. It never changes what we pick or what you pay."
                      : `${money.pieces - money.swapped} ${pieceWord(money.pieces - money.swapped)} still ${money.pieces - money.swapped === 1 ? "needs" : "need"} a swap. We earn a commission on some links.`}
                  </small>
                </>
              ) : (
                <>
                  <div className={styles.pendingNote}>
                    We have identified {money.pieces === 1 ? "this piece" : `all ${money.pieces} pieces`}, but
                    have not found an alternative worth recommending yet.
                  </div>
                  <Link
                    className={styles.pendingAction}
                    href={`/report-a-price?outfit=${encodeURIComponent(slug)}&issue=${encodeURIComponent("Swap suggestion")}`}
                  >
                    Know a good match? Tell us
                  </Link>
                  <small>
                    We only publish a swap once a person has checked it. Until then
                    there is nothing here to sell you.
                  </small>
                </>
              )}
            </div>
          </div>
        </div>

        <RelatedRail title={`More from ${outfit.celebrity}`} outfits={sameCelebrity} />
        <RelatedRail title={`More ${outfit.occasion.toLowerCase()} looks`} outfits={sameOccasion} />

        <div className={styles.byline}>
          <div className={styles.authorAvatar}>R</div>
          <div><p>Decoded by Rabi</p><span>
            Published {shortDate.format(published)}
            {checked ? ` · Prices last checked ${shortDate.format(checked)}` : ""}
          </span></div>
          <Link href={`/report-a-price?outfit=${encodeURIComponent(slug)}&issue=${encodeURIComponent("Price is wrong")}`}>
            Report a wrong price
          </Link>
        </div>
      </div>

      {money.anySwapped ? (
        <div className={`${styles.mobileBar} ${mobileBarVisible ? styles.mobileBarVisible : ""}`}>
          <button type="button" onClick={handleCta}>
            {mode === "swap"
              ? money.allSwapped
                ? `Buy all ${money.pieces} ${pieceWord(money.pieces)} · ${inr.format(money.swapTotal)}`
                : `Buy the ${money.swapped} swapped ${pieceWord(money.swapped)} · ${inr.format(money.swapTotal)}`
              : money.allSwapped
                ? `Get this look for ${inr.format(money.swapTotal)}`
                : `See the ${money.swapped} ${pieceWord(money.swapped)} we have swapped`}
          </button>
        </div>
      ) : null}
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
            <div><Image src={outfitPhoto(outfit)?.url ?? `https://picsum.photos/seed/cpo${outfit.id}/380/475`} alt="" fill sizes="220px" /></div>
            <section>
              <h3>{outfit.celebrity}</h3>
              <p>{outfit.event} · {shortDate.format(new Date(`${outfit.date}T00:00:00`))}</p>
              <span>{isFullySwapped(outfit) ? <><s>{inr.format(outfit.worn)}</s><b>{inr.format(outfit.swap)}</b></> : <b>{inr.format(outfit.worn)}</b>}</span>
            </section>
          </Link>
        ))}
      </div>
    </section>
  );
}
