"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import { archiveTotals, budgetRange, celebrityNames, isNewLook, occasionNames, savingThresholds } from "@/lib/archive";
import { OutfitThumb } from "@/components/site/Thumb";
import { outfitSlug } from "@/lib/slugs";
import { plural } from "@/lib/format";
import { useSavedList } from "@/lib/saved";
import {
  isFullySwapped,
  outfitPhoto,
  pricing,
  savingPercent,
  savingSortKey,
  swapSortKey,
  wornLabel,
  wornSortKey,
} from "@/lib/types";
import type { Outfit } from "@/lib/types";
import styles from "@/app/outfits/outfits.module.css";

type SortMode = "new" | "saving" | "cheap" | "lux";
type PriceMode = "worn" | "swap";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Null when no piece is priced on both sides, so a look with no swap is not
 *  badged "−100%" against a stored total that was never recomputed. */
const saving = (outfit: Outfit) => savingPercent(outfit);

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function OutfitsExplorer({ outfits }: { outfits: Outfit[] }) {
  const router = useRouter();
  const [occasions, setOccasions] = useState<string[]>([]);
  const [celebrities, setCelebrities] = useState<string[]>([]);
  // Every rail below is built from the outfits themselves: a chip is never
  // offered for an occasion or a person the archive holds nothing for, and the
  // slider stops where the dearest complete look does.
  const totals = useMemo(() => archiveTotals(outfits), [outfits]);
  const swapRange = useMemo(() => budgetRange(outfits), [outfits]);
  const occasionOptions = useMemo(() => occasionNames(outfits), [outfits]);
  const celebrityOptions = useMemo(() => celebrityNames(outfits), [outfits]);
  // Her own newest photo, so the chip shows the person rather than a seed.
  const celebrityAvatars = useMemo(() => {
    const byName = new Map<string, string>();
    for (const outfit of [...outfits].sort((a, b) => b.date.localeCompare(a.date))) {
      const photo = outfitPhoto(outfit)?.url;
      if (photo && !byName.has(outfit.celebrity)) byName.set(outfit.celebrity, photo);
    }
    return byName;
  }, [outfits]);
  const savingOptions = useMemo(() => savingThresholds(outfits), [outfits]);
  const anyBudget = swapRange.max;
  const [budget, setBudget] = useState(anyBudget);
  const [minimumSaving, setMinimumSaving] = useState<number | null>(null);
  const [sort, setSort] = useState<SortMode>("new");
  const [shown, setShown] = useState(9);
  const [dense, setDense] = useState(false);
  // Hearts persist in the visitor's browser and are shared with every other
  // surface on the site, so a save survives navigating away.
  const saved = useSavedList("looks");
  const [quickView, setQuickView] = useState<Outfit | null>(null);
  const [priceMode, setPriceMode] = useState<PriceMode>("worn");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const results = useMemo(() => {
    const filtered = outfits.filter((outfit) => {
      if (occasions.length && !occasions.includes(outfit.occasion)) return false;
      if (celebrities.length && !celebrities.includes(outfit.celebrity)) return false;
      if (budget < anyBudget && swapSortKey(outfit) > budget) return false;
      if (minimumSaving && (saving(outfit) ?? -1) < minimumSaving) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      if (sort === "saving") return savingSortKey(b) - savingSortKey(a);
      if (sort === "cheap") return swapSortKey(a) - swapSortKey(b);
      if (sort === "lux") return wornSortKey(b) - wornSortKey(a);
      return b.date.localeCompare(a.date);
    });
  }, [outfits, anyBudget, budget, celebrities, minimumSaving, occasions, sort]);

  const activeFilterCount =
    occasions.length +
    celebrities.length +
    (budget < anyBudget ? 1 : 0) +
    (minimumSaving ? 1 : 0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setQuickView(null);
      setFiltersOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function resetShown() {
    setShown(9);
  }

  function clearAll() {
    setOccasions([]);
    setCelebrities([]);
    setBudget(anyBudget);
    setMinimumSaving(null);
    resetShown();
  }

  function openQuickView(outfit: Outfit) {
    setPriceMode("worn");
    setQuickView(outfit);
  }

  return (
    <div className={styles.page}>
      <header className={styles.band}>
        <div className={`${styles.shell} ${styles.bandInner}`}>
          <div>
            <nav className={styles.crumb} aria-label="Breadcrumb">
              <Link href="/">Home</Link><i>›</i><span>Outfits</span>
            </nav>
            {/* "Every look, decoded" named the page for nothing anybody
                searches; the phrasing carries the same two lines. */}
            <h1>Celebrity outfits,<br />decoded</h1>
            <p className={styles.lede}>
              Every Indian celebrity look in the archive, identified piece by
              piece — the brand she wore, what it cost, and the affordable
              alternative. Filter by occasion, person or budget.
            </p>
          </div>
          <div className={styles.bannerStats} aria-label="Outfit statistics">
            <div><span>{totals.looks.toLocaleString("en-IN")}</span><small>Looks</small></div>
            <div><span>{totals.pieces.toLocaleString("en-IN")}</span><small>Pieces</small></div>
            {totals.averageSavingPct === null ? null : (
              <div><span>{totals.averageSavingPct}%</span><small>Avg saving</small></div>
            )}
          </div>
        </div>
      </header>

      <section className={styles.trending} aria-labelledby="trending-title">
        <div className={styles.shell}>
          <div className={styles.trendingHeading}>
            <span id="trending-title">◆ Most viewed this week</span><i />
          </div>
          <div className={styles.trendingRail}>
            {outfits.slice(0, 8).map((outfit, index) => (
              <Link
                href={`/outfits/${outfitSlug(outfit)}`}
                className={styles.trendingCard}
                key={outfit.id}
                aria-label={`View ${outfit.celebrity}, ${outfit.event}`}
              >
                <OutfitThumb outfit={outfit} decorative sizes="180px" />
                <span className={styles.rank}>{index + 1}</span>
                <span className={styles.trendingMeta}>
                  <b>{outfit.celebrity}</b>
                  <span><CardPrices outfit={outfit} tone="featured" /></span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.shell}>
        <div className={styles.layout}>
          <aside className={`${styles.sidebar} ${filtersOpen ? styles.sidebarOpen : ""}`} aria-label="Outfit filters">
            <FilterGroup title="Occasion" onClear={() => { setOccasions([]); resetShown(); }}>
              {occasionOptions.map((occasion) => (
                <FilterOption
                  key={occasion}
                  selected={occasions.includes(occasion)}
                  count={outfits.filter((outfit) => outfit.occasion === occasion).length}
                  onClick={() => { setOccasions(toggleValue(occasions, occasion)); resetShown(); }}
                >{occasion}</FilterOption>
              ))}
            </FilterGroup>

            <FilterGroup title="Celebrity" onClear={() => { setCelebrities([]); resetShown(); }}>
              {celebrityOptions.map((celebrity) => (
                <FilterOption
                  key={celebrity}
                  selected={celebrities.includes(celebrity)}
                  count={outfits.filter((outfit) => outfit.celebrity === celebrity).length}
                  avatar={celebrityAvatars.get(celebrity)}
                  onClick={() => { setCelebrities(toggleValue(celebrities, celebrity)); resetShown(); }}
                >{celebrity}</FilterOption>
              ))}
            </FilterGroup>

            <div className={styles.filterGroup}>
              <h2>Max swap price</h2>
              <div className={styles.range}>
                <input
                  type="range"
                  min={swapRange.min}
                  max={swapRange.max}
                  step={swapRange.step}
                  value={budget}
                  aria-label="Maximum swap price"
                  onChange={(event) => { setBudget(Number(event.target.value)); resetShown(); }}
                />
                <div><span>{inr.format(swapRange.min)}</span><b>{budget >= anyBudget ? "Any" : inr.format(budget)}</b></div>
              </div>
            </div>

            <FilterGroup title="Minimum saving">
              {savingOptions.map((threshold) => (
                <FilterOption
                  key={threshold}
                  selected={minimumSaving === threshold}
                  onClick={() => { setMinimumSaving(minimumSaving === threshold ? null : threshold); resetShown(); }}
                >{threshold}% or more</FilterOption>
              ))}
            </FilterGroup>

            <button className={`${styles.button} ${styles.primaryButton} ${styles.applyFilters}`} type="button" onClick={() => setFiltersOpen(false)}>
              Show {results.length} results
            </button>
          </aside>

          <main className={styles.results}>
            <div className={styles.toolbar}>
              <p className={styles.count}><b>{results.length}</b> looks</p>
              <div className={styles.viewToggle} role="group" aria-label="Grid density">
                <button type="button" aria-pressed={!dense} title="Comfortable" onClick={() => setDense(false)}>▤</button>
                <button type="button" aria-pressed={dense} title="Compact" onClick={() => setDense(true)}>▦</button>
              </div>
              <select className={styles.control} value={sort} onChange={(event) => { setSort(event.target.value as SortMode); resetShown(); }} aria-label="Sort outfits">
                <option value="new">Newest first</option>
                <option value="saving">Biggest saving</option>
                <option value="cheap">Cheapest swap</option>
                <option value="lux">Most expensive worn</option>
              </select>
            </div>

            {activeFilterCount > 0 && (
              <div className={styles.activeFilters} aria-label="Active filters">
                {occasions.map((occasion) => <FilterPill key={occasion} label={occasion} onRemove={() => setOccasions(occasions.filter((value) => value !== occasion))} />)}
                {celebrities.map((celebrity) => <FilterPill key={celebrity} label={celebrity} onRemove={() => setCelebrities(celebrities.filter((value) => value !== celebrity))} />)}
                {budget < 8000 && <FilterPill label={`Under ${inr.format(budget)}`} onRemove={() => setBudget(8000)} />}
                {minimumSaving && <FilterPill label={`${minimumSaving}%+ saving`} onRemove={() => setMinimumSaving(null)} />}
                <button className={styles.clearAll} type="button" onClick={clearAll}>Clear all</button>
              </div>
            )}

            {results.length ? (
              <div className={`${styles.grid} ${dense ? styles.dense : ""}`}>
                {results.slice(0, shown).map((outfit, index) => (
                  <Fragment key={outfit.id}>
                    <OutfitCard
                      outfit={outfit}
                      featured={index === 0 && sort === "new" && occasions.length === 0}
                      saved={saved.has(outfitSlug(outfit))}
                      onSave={() => saved.toggle(outfitSlug(outfit))}
                      onNavigate={() => router.push(`/outfits/${outfitSlug(outfit)}`)}
                      onQuickView={() => openQuickView(outfit)}
                    />
                    {index === 4 && <PromoCard outfits={outfits} />}
                  </Fragment>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <span>⌕</span>
                <h2>Nothing matches that combination</h2>
                <p>Try widening the budget or removing an occasion — we may not have decoded that pairing yet.</p>
                <button className={`${styles.button} ${styles.primaryButton}`} type="button" onClick={clearAll}>Clear all filters</button>
              </div>
            )}

            {results.length > shown && (
              <div className={styles.loadMore}>
                <div className={styles.progress}><i style={{ width: `${Math.min((shown / results.length) * 100, 100)}%` }} /></div>
                <small>Showing {Math.min(shown, results.length)} of {results.length}</small>
                <button className={`${styles.button} ${styles.ghostButton}`} type="button" onClick={() => setShown(shown + 6)}>Load more looks</button>
              </div>
            )}
          </main>
        </div>
      </div>

      <button className={styles.mobileFilterButton} type="button" onClick={() => setFiltersOpen(true)}>
        ⚙ Filters <em>{activeFilterCount}</em>
      </button>

      {(quickView || filtersOpen) && <button className={styles.scrim} type="button" aria-label="Close overlay" onClick={() => { setQuickView(null); setFiltersOpen(false); }} />}
      {quickView && (
        <QuickView outfit={quickView} mode={priceMode} onModeChange={setPriceMode} onClose={() => setQuickView(null)} />
      )}
    </div>
  );
}


/**
 * One place decides how a card states its prices, so a look that is unpriced,
 * partly swapped or fully swapped can never be described as any of the others.
 */
function CardPrices({ outfit, tone }: { outfit: Outfit; tone: "featured" | "card" }) {
  const money = pricing(outfit);
  const worn = money.anyPriced ? inr.format(money.wornTotal) : "Price unconfirmed";
  const Swap = tone === "featured" ? "em" : "b";

  if (money.allSwapped) {
    return (
      <>
        {/* Only cross out a real figure the swap replaces. */}
        {money.anyPriced ? <s>{worn}</s> : <span>{worn}</span>}
        <Swap>{inr.format(money.swapTotal)}</Swap>
      </>
    );
  }
  return (
    <>
      <span>{worn}</span>
      <Swap>
        {money.anySwapped
          ? `${inr.format(money.swapTotal)} · ${money.swapped} of ${money.pieces} swapped`
          : "No swap yet"}
      </Swap>
    </>
  );
}

function FilterGroup({ title, onClear, children }: { title: string; onClear?: () => void; children: React.ReactNode }) {
  return (
    <div className={styles.filterGroup}>
      <h2>{title}{onClear && <button type="button" onClick={onClear}>Clear</button>}</h2>
      {children}
    </div>
  );
}

function FilterOption({ selected, count, avatar, onClick, children }: { selected: boolean; count?: number; avatar?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={styles.filterOption} aria-pressed={selected} onClick={onClick}>
      {avatar ? <Image className={styles.avatar} src={avatar} width={24} height={24} alt="" /> : <span className={styles.checkbox}>✓</span>}
      <span className={styles.optionName}>{children}</span>
      {count !== undefined && <span className={styles.optionCount}>{count}</span>}
    </button>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <span className={styles.filterPill}>{label}<button type="button" onClick={onRemove} aria-label={`Remove ${label} filter`}>×</button></span>;
}

function OutfitCard({ outfit, featured, saved, onSave, onNavigate, onQuickView }: { outfit: Outfit; featured: boolean; saved: boolean; onSave: () => void; onNavigate: () => void; onQuickView: () => void }) {
  const percentage = saving(outfit);
  const money = pricing(outfit);
  return (
    <article
      className={`${styles.card} ${featured ? styles.featured : ""}`}
      tabIndex={0}
      onClick={onNavigate}
      onKeyDown={(event) => { if (event.key === "Enter") onNavigate(); }}
    >
      <div className={styles.cardImage}>
        <OutfitThumb
          outfit={outfit}
          sizes={featured ? "(max-width: 1023px) 100vw, 55vw" : "(max-width: 700px) 50vw, 30vw"}
        />
        {featured ? <span className={styles.featuredLabel}>Look of the week</span> : (
          <>
            <div className={styles.badges}>
              <span>{shortDate(outfit.date)}</span>
              {isNewLook(outfit) && <b>New</b>}
              {money.allSwapped && percentage !== null && percentage >= 97 && <em>Top swap</em>}
            </div>
            <span className={styles.occasion}>{outfit.occasion}</span>
            <span className={styles.saving}>{money.allSwapped && percentage !== null ? `−${percentage}%` : "No swap yet"}</span>
            <div className={styles.peek}>
              {outfit.items.slice(0, 3).map((item) => <span key={item.name}>{item.name}<b>{item.swap === undefined ? "—" : inr.format(item.swap)}</b></span>)}
              <button type="button" onClick={(event) => { event.stopPropagation(); onQuickView(); }}>Quick view</button>
            </div>
          </>
        )}
        <button
          type="button"
          className={styles.heart}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${outfit.celebrity} look from saved` : `Save ${outfit.celebrity} look`}
          onClick={(event) => { event.stopPropagation(); onSave(); }}
        >{saved ? "♥" : "♡"}</button>
      </div>
      <div className={styles.cardBody}>
        <h2>{outfit.celebrity}</h2>
        <p>{outfit.event}{featured && ` · ${outfit.items.length} ${outfit.items.length === 1 ? "piece" : "pieces"} identified`}</p>
        <div className={styles.prices}><CardPrices outfit={outfit} tone="card" /></div>
        {!featured && percentage !== null && <span className={styles.savingBar}><i style={{ width: `${percentage}%` }} /></span>}
      </div>
    </article>
  );
}

/**
 * The tile used to promise "64 complete looks" under ₹2,000 whatever the
 * archive held. It now counts them, and stays out of the grid entirely when
 * there is nothing to count.
 */
function PromoCard({ outfits }: { outfits: Outfit[] }) {
  const tier = 2000;
  const count = outfits.filter(
    (outfit) => isFullySwapped(outfit) && pricing(outfit).swapTotal <= tier,
  ).length;
  if (count === 0) return null;

  return (
    <Link className={styles.promo} href={`/budget?budget=${tier}`}>
      <span>Shop by wallet</span>
      <h2>Under<br />₹2,000</h2>
      <p>{plural(count, "complete look")} you can build for less than a dinner out.</p>
      <b>Browse →</b>
    </Link>
  );
}

/** The modal total, which used to print the stored ₹0 for a look with no swap. */
function QuickViewTotal({ outfit, mode }: { outfit: Outfit; mode: PriceMode }) {
  const money = pricing(outfit);
  const shown =
    mode === "worn"
      ? money.anyPriced
        ? inr.format(money.wornTotal)
        : "Not confirmed yet"
      : money.anySwapped
        ? inr.format(money.swapTotal)
        : "No swap yet";
  return (
    <div className={styles.modalTotal}>
      <span>{mode === "worn" ? "Total as worn" : "Total for the swap"}</span>
      <b>{shown}</b>
    </div>
  );
}

function QuickView({ outfit, mode, onModeChange, onClose }: { outfit: Outfit; mode: PriceMode; onModeChange: (mode: PriceMode) => void; onClose: () => void }) {
  return (
    <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="quick-view-title">
      <div className={styles.modalImage}>
        <OutfitThumb outfit={outfit} sizes="(max-width: 800px) 94vw, 540px" />
        <button type="button" onClick={onClose} aria-label="Close quick view">×</button>
      </div>
      <div className={styles.modalBody}>
        <h2 id="quick-view-title">{outfit.celebrity}</h2>
        <p className={styles.modalMeta}>{outfit.event} · {shortDate(outfit.date)} 2026 · {outfit.items.length} pieces</p>
        <div className={`${styles.priceToggle} ${mode === "swap" ? styles.swapMode : ""}`} role="tablist">
          <i />
          <button type="button" role="tab" aria-selected={mode === "worn"} onClick={() => onModeChange("worn")}>As worn</button>
          <button type="button" role="tab" aria-selected={mode === "swap"} onClick={() => onModeChange("swap")}>The swap</button>
        </div>
        <div>
          {outfit.items.map((item) => (
            <div className={styles.modalLine} key={item.name}>
              <div>{item.name}<small>{mode === "worn" ? wornLabel(item) : (item.swapBrand ?? "No swap found yet")}</small></div>
              <b>{(mode === "worn" ? item.worn : item.swap) === undefined ? "—" : inr.format((mode === "worn" ? item.worn : item.swap) as number)}</b>
            </div>
          ))}
        </div>
        <QuickViewTotal outfit={outfit} mode={mode} />
        <Link className={`${styles.button} ${styles.primaryButton}`} href={`/outfits/${outfitSlug(outfit)}`}>See full breakdown →</Link>
      </div>
    </div>
  );
}
