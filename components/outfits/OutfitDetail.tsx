"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { wornBrands } from "@/lib/archive";
import { headline } from "@/lib/outfit-seo";
import { PIECE_COLOURS } from "@/lib/taxonomy";
import { budgetBucket, budgetLabel, budgetSlug } from "@/lib/budget";
import { BlankFrame, OutfitThumb, outfitAlt } from "@/components/site/Thumb";
import { nameSlug, outfitSlug } from "@/lib/slugs";
import { useSavedList } from "@/lib/saved";
import {
  effectiveCredit,
  isBuyable,
  isMonetised,
  leadPiece,
  outfitOccasions,
  outfitPhotos,
  pieceLink,
  pricing,
  wornLabel,
  type OutfitItem,
} from "@/lib/types";
import { piecePrice, sideOf, tagFor } from "@/lib/link-display";

/** Both halves of a look, rendered together so neither depends on hydration. */
const PRICE_MODES: PriceMode[] = ["worn", "swap"];

/** Inline, because `.lines` and `.total` set their own display, which would
 *  beat the `hidden` attribute's stylesheet rule. */
const HIDDEN = { display: "none" } as const;
import type { Outfit } from "@/lib/types";
import { lastCheckedAt, priceFreshness } from "@/lib/freshness";
import { author as AUTHOR } from "@/lib/site-config";
import { isSpecificCredit } from "@/lib/photo-credit";
import { trackEvent } from "@/lib/analytics";
import styles from "@/app/outfits/[slug]/outfit-detail.module.css";

import type { PriceMode } from "@/lib/link-display";
import { CardPrice, cardPriceValues } from "@/components/site/CardPrice";

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
  /** A piece to scroll to once the swap tab has actually rendered. A ref, not
   *  state: it schedules work, it does not describe anything on screen. */
  const pendingJump = useRef<number | null>(null);
  const [mobileBarVisible, setMobileBarVisible] = useState(false);
  const [shot, setShot] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const viewTracked = useRef(false);
  const published = new Date(`${outfit.date}T00:00:00`);
  // Was a hardcoded "2 days ago" on every look, whatever the truth.
  // The later of the editor's own check and the newest link check, so a look
  // whose links were confirmed this morning does not read as weeks stale.
  const checkedAt = lastCheckedAt(outfit);
  const checked = checkedAt ? new Date(`${checkedAt}T00:00:00`) : null;
  const freshness = priceFreshness(checkedAt);
  const money = pricing(outfit);
  /** At least one swap a reader could actually click through and buy. */
  const shoppable = outfit.items.some((item) => isBuyable(pieceLink(item, "swap")));
  /**
   * Whether anything on this page can earn us a commission.
   *
   * The disclosure was printed on every outfit page whatever it linked to, so
   * a look with no monetised link at all still told the reader we might be
   * paid for it. Saying we may earn a commission where we cannot is the same
   * kind of untruth as saying we do not where we can — it just costs us
   * credibility rather than theirs.
   */
  const hasAffiliate = outfit.items.some(
    (item) =>
      isMonetised(pieceLink(item, "original")) || isMonetised(pieceLink(item, "swap")),
  );
  // The look sheet beside the write-up, read off what the editor filed each
  // piece under. It used to be parsed out of piece names — the last word as the
  // garment, any colour word as a swatch — which is how "… Midi Dress with Mesh
  // Sleeves" was filed as Sleeves and a heel called "Black Rose" put Rose in the
  // palette. A look with no categories or colours yet shows fewer rows.
  const labels = wornBrands([outfit]);
  // The high-street labels the swaps point at, each with a page of its own.
  const swapLabels = [
    ...new Set(outfit.items.flatMap((item) => (item.swapBrand ? [item.swapBrand] : []))),
  ].filter((name) => !labels.some((label) => label.name.toLowerCase() === name.toLowerCase()));
  const garments = [...new Set(outfit.items.flatMap((item) => (item.category && item.category !== "other" ? [item.category] : [])))];
  const palette = [...new Set(outfit.items.flatMap((item) => item.colours ?? []))];
  const occasions = outfitOccasions(outfit);
  const lead = leadPiece(outfit);
  // The smallest budget page this look fits: swap total, or worn if no swap.
  const bucket = budgetBucket(outfit);
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
    if (!viewTracked.current) {
      viewTracked.current = true;
      trackEvent("outfit_view", {
        outfit_id: slug,
        celebrity_name: outfit.celebrity,
        source_page: `/outfits/${slug}`,
      });
    }

    const target = ctaRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setMobileBarVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [outfit.celebrity, slug]);

  function trackProductClick(index: number) {
    const item = outfit.items[index];
    const brand = mode === "worn" ? item.wornBrand : item.swapBrand;
    // The retailer is recorded on the link now rather than guessed from the
    // hostname each time, so this and the click log name it the same way.
    const retailer = pieceLink(item, sideOf(mode))?.retailer;
    const metadata = {
      celebrity_name: outfit.celebrity,
      outfit_id: slug,
      brand,
      retailer,
      product_type: item.name,
      original_or_swap: mode,
      source_page: `/outfits/${slug}`,
    };
    trackEvent("affiliate_click", metadata);
    trackEvent(mode === "worn" ? "original_product_click" : "swap_click", metadata);
  }

  function selectMode(nextMode: PriceMode) {
    setMode(nextMode);
  }

  // Runs once the tab has changed, so the swap list is on the page and the
  // element is always there to scroll to.
  useEffect(() => {
    const target = pendingJump.current;
    if (target === null) return;
    pendingJump.current = null;
    setHighlighted(target);
    document.getElementById(`outfit-item-${target}`)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    });
    const timer = window.setTimeout(() => setHighlighted(null), 1400);
    return () => window.clearTimeout(timer);
  }, [mode]);

  function jumpToItem(index: number) {
    setHighlighted(index);
    document.getElementById(`outfit-item-${index}`)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    });
    window.setTimeout(() => setHighlighted(null), 1400);
  }

  /**
   * The CTA under the totals, and the one in the sticky mobile bar.
   *
   * It used to be `if (mode === "worn") setMode("swap")` and nothing else —
   * so on the swap tab, where it reads "Buy all 3 pieces · ₹4,280", the most
   * commercial button on the site was a click that did nothing at all.
   *
   * A browser cannot open several tabs from one gesture and it should not try,
   * so the button does the only useful thing left: it puts the reader in front
   * of the pieces they can actually buy, with the first one highlighted and
   * its Buy button in view. `jumpToItem` already existed for the hotspot dots.
   */
  function handleCta() {
    const first = outfit.items.findIndex((item) => isBuyable(pieceLink(item, "swap")));
    if (first === -1) return;

    if (mode === "worn") {
      setMode("swap");
      // The swap list has not rendered on this pass, so the scroll is left to
      // the effect below rather than to a guess about when React flushes.
      pendingJump.current = first;
      return;
    }
    jumpToItem(first);
  }

  async function shareLook() {
    const data = {
      title: heading,
      text: `${outfit.celebrity} at ${outfit.event}, decoded on CelebrityPersona`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        trackEvent("share", { outfit_id: slug, source_page: `/outfits/${slug}`, method: "native" });
        return;
      }
      await navigator.clipboard.writeText(data.url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
      trackEvent("share", { outfit_id: slug, source_page: `/outfits/${slug}`, method: "clipboard" });
    } catch (error) {
      // Closing the native share sheet is not an error the page needs to show.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setShareCopied(false);
      }
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.crumb} aria-label="Breadcrumb">
          <Link href="/">Home</Link><i>›</i>
          <Link href="/outfits">Outfits</Link><i>›</i>
          {/* Her crumb was plain text while the page's BreadcrumbList told
              Google it was a link to her archive — the markup has to describe
              the trail the reader can actually walk. It is now the link the
              schema always claimed, which also gives every look on the site a
              crumb-level link to its celebrity hub. `.crumb a` carries only a
              hover colour, so at rest it looks exactly as it did. */}
          <Link href={`/celebrities/${nameSlug(outfit.celebrity)}`}>{outfit.celebrity}</Link><i>›</i>
          <span>{outfit.event}</span>
        </nav>

        <div className={styles.split}>
          <div className={styles.photoColumn}>
            <figure className={styles.frame}>
              {shown ? (
              <Image
                src={shown.url}
                // What the editor says the photo shows, when she has said it.
                alt={outfitAlt(outfit, photos.indexOf(shown))}
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
              {/* An uncredited photo used to caption itself "Photo · Editorial
                  archive", which names no archive and no photographer. It is
                  an invented attribution printed over somebody else's work.
                  New photos cannot be saved without a real credit; ones
                  already stored without one say so until they have been
                  given one. */}
              {shown ? (
                <figcaption>
                  {isSpecificCredit(effectiveCredit(outfit, shown))
                    ? effectiveCredit(outfit, shown)
                    : "Photo · source not yet credited"}
                </figcaption>
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
                    {/* The photo's own alt, so every picture in the set is
                        described for image search, not only the one shown. */}
                    <Image src={photo.url} alt={outfitAlt(outfit, index)} fill sizes="90px" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className={styles.ledger}>
            <header className={styles.title}>
              <p>Decoded · {outfit.items.length} {pieceWord(outfit.items.length)}</p>
              <h1>{heading}</h1>
              {/* These two links were slugged inline, with a rule that did not
                  strip the leading or trailing hyphen `nameSlug` removes — so a
                  name or occasion ending in anything but a letter or digit
                  ("Sabyasachi x H&M", "Red carpet.") linked to a URL no page
                  answers on. `nameSlug` was already imported here; the whole
                  site now derives these two the one way. */}
              <div>
                <time dateTime={outfit.date}>{longDate.format(published)}</time> ·{" "}
                <Link href={`/occasions/${nameSlug(outfit.occasion)}`}>{outfit.occasion} looks</Link> ·{" "}
                <Link href={`/celebrities/${nameSlug(outfit.celebrity)}`}>{outfit.celebrity} archive</Link>
              </div>
            </header>

            {money.anySwapped ? (
              <div className={`${styles.toggle} ${mode === "swap" ? styles.swapMode : ""}`} role="tablist" aria-label="Price mode">
                <i />
                <button type="button" role="tab" aria-selected={mode === "worn"} onClick={() => selectMode("worn")}>As worn</button>
                <button type="button" role="tab" aria-selected={mode === "swap"} onClick={() => selectMode("swap")}>The swap</button>
              </div>
            ) : null}

            {/*
              The disclosure, at the point of use.

              /affiliate-disclosure has always existed and is linked from every
              footer, which satisfies nobody: the FTC asks for the disclosure to
              be clear and conspicuous where the endorsement is, and a reader
              who clicks Buy from this list never passes the footer. So it is
              stated here, immediately above the first affiliate link on the
              page, in the reader's own words rather than as a legal formula —
              and it says the part that actually matters to them, which is that
              the commission does not decide what gets recommended.
            */}
            {hasAffiliate ? (
            <p className={styles.disclosure}>
              <i aria-hidden="true">Heads up</i>
              <span>
                Some links below are affiliate links, and we may earn a small
                commission if you buy through one — at no extra cost to you. It
                never changes which piece we pick or the price we print.{" "}
                <Link href="/affiliate-disclosure">How this works</Link>
              </span>
            </p>
            ) : null}

            {/*
              Both sides are in the markup; only one is displayed.

              This list used to render `mode`, which starts at "worn" — so the
              swap half of every look existed only after React hydrated. The
              server HTML carried the original and never the alternative: the
              swap brand appeared nowhere but the <title>, the swap price
              nowhere but the CTA, and the Buy links not at all. The one thing
              this site is for was invisible to anything that does not run
              JavaScript, which includes most of what reads a page.

              Rendering both panes as siblings and hiding the inactive one
              keeps the visible page identical — the same element, in the same
              place, with the same classes — while putting the swap into the
              HTML. Display is set inline rather than with the `hidden`
              attribute because `.lines` sets its own `display`, which would
              win over `[hidden]`.
            */}
            {PRICE_MODES.map((pane) => (
            <div className={styles.lines} key={pane} style={pane === mode ? undefined : HIDDEN}>
              {/* The tabs above say which list this is to a sighted reader; the
                  heading says it to everything else, and gives the page its
                  H2s. Visually hidden, because the tab already shows it. */}
              <h2 className={styles.srOnly}>{pane === "worn" ? "As worn" : "The swap"}</h2>
              {outfit.items.map((item, index) => (
                <article id={pane === mode ? `outfit-item-${index}` : undefined} className={`${styles.line} ${highlighted === index && pane === mode ? styles.highlighted : ""}`} key={item.name}>
                  <div>
                    {/* Both lists are in the HTML, so the same name under both
                        would repeat every heading. The swap list names what it
                        is a swap for. */}
                    <h3>{pane === "worn" ? item.name : `Swap for the ${item.name}`}</h3>
                    <p>{pane === "worn" ? wornLabel(item) : (item.swapBrand ?? "No swap found yet")}</p>
                    <span className={`${styles.stockTag} ${tagFor(item, pane).archived ? styles.archived : ""}`}>
                      {tagFor(item, pane).text}
                    </span>
                    {item.note ? <em className={styles.lineNote}>{item.note}</em> : null}
                  </div>
                  <div className={styles.linePrice}>
                    <b>{piecePrice(item, pane)}</b>
                    {/*
                      A button is drawn only where there is somewhere to send
                      somebody. This used to render a disabled "Buy" beside the
                      words "link pending" — an offer and its own refusal in
                      the same row, which reads as a broken page rather than as
                      an honest gap. Sold out, dead and pending links now say
                      what they are in the tag to the left and put no control
                      here at all.
                    */}
                    {isBuyable(pieceLink(item, sideOf(pane))) ? (
                      <a
                        href={`/go/${item.id}?side=${sideOf(pane)}&from=${encodeURIComponent(`/outfits/${slug}`)}`}
                        target="_blank"
                        rel="sponsored nofollow noopener"
                        onClick={() => trackProductClick(index)}
                      >
                        Buy
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
            ))}

            {/* The totals follow their list into the markup, for the same
                reason. The worn total printed an em dash when no original had
                been priced — a mark standing in for data, under a label that
                had already said the prices were unconfirmed. It says one thing
                or the other now, not both. */}
            {PRICE_MODES.map((pane) => {
              const total = paneTotal(pane, money, lead);
              return (
                <div className={styles.total} key={pane} style={pane === mode ? undefined : HIDDEN}>
                  <span>{total.label}</span>
                  {total.amount === null ? null : <b aria-live="polite">{inr.format(total.amount)}</b>}
                </div>
              );
            })}
            <div className={styles.purchaseBox}>
              <p className={`${styles.freshness} ${styles[freshness.tone]}`}>
                ◷ <strong>{freshness.label}</strong>
                {checked ? ` · ${shortDate.format(checked)}` : ""}
                {freshness.tone === "current" ? "" : ` · ${freshness.warning}`}
              </p>

              {/* A CTA promising to take you shopping is only shown when
                  there is a working link behind at least one swap. A look
                  whose swaps are all pending or dead still shows its prices;
                  it just does not offer to sell you anything. */}
              {shoppable ? (
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
                    {/* The commission half is only said where one can be
                        earned; the swap-count half is true either way. */}
                    {money.allSwapped
                      ? hasAffiliate
                        ? "We earn a commission on some links. It never changes what we pick or what you pay."
                        : "We never change what we pick or what you pay."
                      : `${money.pieces - money.swapped} ${pieceWord(money.pieces - money.swapped)} still ${money.pieces - money.swapped === 1 ? "needs" : "need"} a swap.${hasAffiliate ? " We earn a commission on some links." : ""}`}
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
                    {labels.map((brand) => (
                      <dd key={brand.name}>
                        <Link href={`/brands/${nameSlug(brand.name)}`}>{brand.name}</Link>
                      </dd>
                    ))}
                  </div>
                ) : null}
                {swapLabels.length ? (
                  <div>
                    <dt>The swaps from</dt>
                    {swapLabels.map((name) => (
                      <dd key={name}>
                        <Link href={`/brands/${nameSlug(name)}`}>{name}</Link>
                      </dd>
                    ))}
                  </div>
                ) : null}
                {garments.length ? (
                  <div>
                    <dt>{garments.length === 1 ? "The piece" : "The pieces"}</dt>
                    <dd>{garments.map(titleCase).join(" · ")}</dd>
                  </div>
                ) : null}
                {palette.length ? (
                  <div>
                    <dt>Palette</dt>
                    <dd className={styles.swatches}>
                      {palette.map((colour, index) => (
                        <span key={colour}>
                          {/* A separator the eye does not need but a text
                              reader does: without it the row read "BlackRose". */}
                          {index > 0 ? <span className={styles.srOnly}>, </span> : null}
                          <i style={{ background: PIECE_COLOURS[colour] }} />
                          {titleCase(colour)}
                        </span>
                      ))}
                    </dd>
                  </div>
                ) : null}
                {bucket ? (
                  <div>
                    <dt>Budget</dt>
                    <dd>
                      <Link href={`/budget/${budgetSlug(bucket)}`}>Looks {budgetLabel(bucket).toLowerCase()}</Link>
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>{occasions.length === 1 ? "Occasion" : "Occasions"}</dt>
                  {occasions.map((name) => (
                    <dd key={name}>
                      <Link href={`/occasions/${nameSlug(name)}`}>{name} looks</Link>
                    </dd>
                  ))}
                </div>
              </dl>
              {asidePhoto ? (
                <figure className={styles.asideShot}>
                  <Image
                    src={asidePhoto.url}
                    alt={outfitAlt(outfit, allPhotos.length - 1)}
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

        {outfit.faqs?.length ? (
          <section className={styles.faqs}>
            <h2>Questions</h2>
            {/* Shown, not marked up: Google keeps FAQ rich results for
                government and health sites, and the answers are for readers. */}
            <dl>
              {outfit.faqs.map((faq) => (
                <div key={faq.question}>
                  <dt>
                    <h3>{faq.question}</h3>
                  </dt>
                  <dd>{faq.answer}</dd>
                </div>
              ))}
            </dl>
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
          {/* Both dates were plain text, so the one date a reader most wants
              from a price page — when the prices were last checked — was
              readable by a person and by nothing else. `<time>` is inline and
              unstyled, so the byline looks exactly as it did. */}
          <div><p>Decoded by Rabi</p><span>
            Published <time dateTime={outfit.date}>{shortDate.format(published)}</time>
            {" · "}
            {/* Who decoded this. The celebrity and occasion pages already
                carried a byline; the outfit pages, which are the ones Google
                reads as articles, did not. */}
            Decoded by <Link href={AUTHOR.path}><b>{AUTHOR.name}</b></Link>
            {checked && checkedAt ? (
              <> · Prices last checked <time dateTime={checkedAt}>{shortDate.format(checked)}</time></>
            ) : null}
          </span></div>
          <Link href={`/report-a-price?outfit=${encodeURIComponent(slug)}&issue=${encodeURIComponent("Price is wrong")}`}>
            Report a wrong price
          </Link>
          <button type="button" onClick={shareLook}>{shareCopied ? "Link copied" : "Share this look"}</button>
        </div>
      </div>

      {shoppable ? (
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
  return (
    <span>
      <CardPrice {...cardPriceValues(outfit)} />
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
              {/* The look's own title: every card in "More from her" used to
                  carry the same H3, her name. */}
              <h3>{headline(outfit)}</h3>
              <p>{outfit.event} · {shortDate.format(new Date(`${outfit.date}T00:00:00`))}</p>
              <RelatedPrice outfit={outfit} />
            </section>
          </Link>
        ))}
      </div>
    </section>
  );
}

const titleCase = (value: string) =>
  value.replace(/(^|[\s-])([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase());

/**
 * What the totals line says under each list.
 *
 * "Total for 1 of 2 priced" left the reader to work out which one, and said it
 * even when the missing price was the piece the look is about — a total that
 * leaves out the dress is not a total of this look. The worn total is shown
 * only when the lead piece is priced; the swap total always says how many
 * pieces it covers, and there is no ₹0 for a look with no swap yet.
 */
function paneTotal(
  pane: PriceMode,
  money: ReturnType<typeof pricing>,
  lead: OutfitItem | undefined,
): { label: string; amount: number | null } {
  const of = (count: number) => `${count} of ${money.pieces} ${money.pieces === 1 ? "piece" : "pieces"}`;
  if (pane === "worn") {
    if (money.allPriced) return { label: "Total as worn", amount: money.wornTotal };
    if (!money.anyPriced) return { label: "Original prices unconfirmed", amount: null };
    if (lead && typeof lead.worn !== "number") {
      // The category is shorter and says the same thing: "the dress".
      const what = lead.category && lead.category !== "other" ? lead.category : "lead piece";
      return { label: `Original price of the ${what} unconfirmed`, amount: null };
    }
    return { label: `Worn total (${of(money.priced)})`, amount: money.wornTotal };
  }
  if (!money.anySwapped) return { label: "No swap found yet", amount: null };
  if (money.allSwapped) return { label: "Total for the swap", amount: money.swapTotal };
  return { label: `Swap total (${of(money.swapped)})`, amount: money.swapTotal };
}
