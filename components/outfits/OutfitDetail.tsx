"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { garmentsIn, paletteIn, wornBrands } from "@/lib/archive";
import { BlankFrame, OutfitThumb, outfitAlt } from "@/components/site/Thumb";
import { nameSlug, outfitSlug } from "@/lib/slugs";
import { useSavedList } from "@/lib/saved";
import { outfitPhotos, pricing } from "@/lib/types";
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
  heading,
  sameCelebrity,
  sameOccasion,
}: {
  outfit: Outfit;
  /** The same line the title tag carries, so the page's heading and its blue
   *  link answer the same question. "Kashaf Ali at Shaadi Season Look" was the
   *  event field read out loud; the title had already worked out that the
   *  search is for the garment and the label. */
  heading: string;
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
  // The look sheet beside the write-up. Every line is read off the pieces
  // themselves, so a look with one label and no colour in its piece names
  // simply shows fewer rows rather than an invented one.
  const labels = wornBrands([outfit]);
  const garments = garmentsIn([outfit], 6);
  const palette = paletteIn([outfit], 5);
  // The dots were placed on the cover, so they only belong on the cover.
  const allPhotos = outfitPhotos(outfit);
  /**
   * The last photo is held back from the gallery and run beside the write-up
   * instead, where the fact rail leaves room for it. It only leaves the strip
   * when there is somewhere for it to go: with no write-up, or with a single
   * photo, the gallery keeps everything.
   */
  const asidePhoto =
    outfit.notes?.length && allPhotos.length > 1
      ? allPhotos[allPhotos.length - 1]
      : undefined;
  const photos = asidePhoto ? allPhotos.slice(0, -1) : allPhotos;
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
              {shown ? (
              <Image
                src={shown.url}
                // What the editor says the photo shows, when she has said it.
                alt={shown.alt?.trim() || outfitAlt(outfit)}
                fill
                // `priority` is deprecated in Next 16; this hero is the LCP.
                preload
                // The frame is capped against the viewport height, so it is
                // never wider than this however wide the window gets. Saying
                // 58vw here had the browser fetching a candidate half again
                // larger than anything it could display.
                sizes="(max-width: 1023px) 100vw, 740px"
              />
              ) : (
                <BlankFrame seed={outfit.id} />
              )}
              {shown ? (
                <figcaption>{shown.credit ?? "Photo · Editorial archive"}</figcaption>
              ) : null}
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
              <h1>{heading}</h1>
              <div>{longDate.format(published)} · <Link href={`/occasions/${outfit.occasion.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{outfit.occasion} looks</Link> · <Link href={`/celebrities/${outfit.celebrity.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{outfit.celebrity} archive</Link></div>
            </header>

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
                    <span className={`${styles.stockTag} ${mode === "worn" && (!item.wornUrl || item.soldOut) ? styles.archived : ""}`}>
                      {mode === "swap"
                        ? item.swapBrand
                          ? item.swapUrl
                            ? "Similar · buy it"
                            : "Similar · link pending"
                          : "Still looking"
                        : item.soldOut
                          ? "Exact · sold out"
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

        {outfit.notes?.length ? (
          <section className={styles.notes}>
            <h2>About this look</h2>
            <div className={styles.prose}>
              {outfit.notes.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <div className={styles.notesRail}>
              <dl className={styles.lookSheet}>
                {labels.length ? (
                  <div>
                    <dt>{labels.length === 1 ? "The label" : "The labels"}</dt>
                    {labels.map((brand) => <dd key={brand.name}>{brand.name}</dd>)}
                  </div>
                ) : null}
                {garments.length ? (
                  <div>
                    <dt>{garments.length === 1 ? "The piece" : "The pieces"}</dt>
                    <dd>{garments.map((garment) => garment.name).join(" · ")}</dd>
                  </div>
                ) : null}
                {palette.length ? (
                  <div>
                    <dt>Palette</dt>
                    <dd className={styles.swatches}>
                      {palette.map((colour) => (
                        <span key={colour.name}>
                          <i style={{ background: colour.value }} />{colour.name}
                        </span>
                      ))}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Occasion</dt>
                  <dd>
                    <Link href={`/occasions/${nameSlug(outfit.occasion)}`}>
                      {outfit.occasion} looks
                    </Link>
                  </dd>
                </div>
              </dl>
              {asidePhoto ? (
                <figure className={styles.asideShot}>
                  <Image
                    src={asidePhoto.url}
                    alt={asidePhoto.alt?.trim() || `${outfit.celebrity} at ${outfit.event}`}
                    fill
                    sizes="(max-width: 1023px) 100vw, 340px"
                  />
                  {asidePhoto.credit?.trim() ? (
                    <figcaption>{asidePhoto.credit}</figcaption>
                  ) : null}
                </figure>
              ) : null}
            </div>
          </section>
        ) : null}

        <RelatedRail
          title={`More from ${outfit.celebrity}`}
          outfits={sameCelebrity}
          moreHref={`/celebrities/${nameSlug(outfit.celebrity)}`}
          moreLabel={`All ${outfit.celebrity} outfits`}
        />
        <RelatedRail
          title={`More ${outfit.occasion.toLowerCase()} looks`}
          outfits={sameOccasion}
          moreHref={`/occasions/${nameSlug(outfit.occasion)}`}
          moreLabel={`All ${outfit.occasion.toLowerCase()} outfits`}
        />

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

/** The rail used to print the stored ₹0 as a swap price. */
function RelatedPrice({ outfit }: { outfit: Outfit }) {
  const money = pricing(outfit);
  return (
    <span>
      {money.anyPriced ? <s>{inr.format(money.wornTotal)}</s> : <em>Price unconfirmed</em>}
      {money.anySwapped ? <b>{inr.format(money.swapTotal)}</b> : <em>No swap yet</em>}
    </span>
  );
}

/**
 * Both rails used to send "View all" to /outfits, which is the least specific
 * page on the site. A rail titled "More from Alia Bhatt" belongs pointed at
 * her archive, and one titled "More sangeet looks" at the sangeet page — the
 * anchor then says where it goes, and the crawl reaches the pages that most
 * want the link.
 */
function RelatedRail({
  title,
  outfits,
  moreHref,
  moreLabel,
}: {
  title: string;
  outfits: Outfit[];
  moreHref: string;
  moreLabel: string;
}) {
  if (!outfits.length) return null;

  return (
    <section className={styles.related}>
      <div className={styles.relatedHeading}>
        <h2>{title}</h2><Link href={moreHref}>{moreLabel} →</Link>
      </div>
      <div className={styles.relatedRail}>
        {outfits.map((outfit) => (
          <Link className={styles.relatedCard} href={`/outfits/${outfitSlug(outfit)}`} key={outfit.id}>
            <div><OutfitThumb outfit={outfit} decorative sizes="220px" /></div>
            <section>
              <h3>{outfit.celebrity}</h3>
              <p>{outfit.event} · {shortDate.format(new Date(`${outfit.date}T00:00:00`))}</p>
              <RelatedPrice outfit={outfit} />
            </section>
          </Link>
        ))}
      </div>
    </section>
  );
}
