"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import { outfitCelebrities, outfitOccasions, savingThresholds } from "@/lib/filters";
import { outfitSlug } from "@/lib/slugs";
import type { Outfit } from "@/lib/types";
import styles from "@/app/outfits/outfits.module.css";

type SortMode = "new" | "saving" | "cheap" | "lux";
type PriceMode = "worn" | "swap";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function saving(outfit: Outfit) {
  return Math.round((1 - outfit.swap / outfit.worn) * 100);
}

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
  const [budget, setBudget] = useState(8000);
  const [minimumSaving, setMinimumSaving] = useState<number | null>(null);
  const [sort, setSort] = useState<SortMode>("new");
  const [shown, setShown] = useState(9);
  const [dense, setDense] = useState(false);
  const [saved, setSaved] = useState<number[]>([]);
  const [quickView, setQuickView] = useState<Outfit | null>(null);
  const [priceMode, setPriceMode] = useState<PriceMode>("worn");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const results = useMemo(() => {
    const filtered = outfits.filter((outfit) => {
      if (occasions.length && !occasions.includes(outfit.occasion)) return false;
      if (celebrities.length && !celebrities.includes(outfit.celebrity)) return false;
      if (budget < 8000 && outfit.swap > budget) return false;
      if (minimumSaving && saving(outfit) < minimumSaving) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      if (sort === "saving") return b.worn - b.swap - (a.worn - a.swap);
      if (sort === "cheap") return a.swap - b.swap;
      if (sort === "lux") return b.worn - a.worn;
      return b.date.localeCompare(a.date);
    });
  }, [outfits, budget, celebrities, minimumSaving, occasions, sort]);

  const activeFilterCount =
    occasions.length +
    celebrities.length +
    (budget < 8000 ? 1 : 0) +
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
    setBudget(8000);
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
            <h1>Every look,<br />decoded</h1>
            <p className={styles.lede}>
              Each outfit identified piece by piece — what she paid, and what
              you&apos;d pay. Filter by occasion, person or budget.
            </p>
          </div>
          <div className={styles.bannerStats} aria-label="Outfit statistics">
            <div><span>486</span><small>Looks</small></div>
            <div><span>2,140</span><small>Pieces</small></div>
            <div><span>94%</span><small>Avg saving</small></div>
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
                <Image
                  src={`https://picsum.photos/seed/cpo${outfit.id}/360/480`}
                  alt=""
                  fill
                  sizes="180px"
                />
                <span className={styles.rank}>{index + 1}</span>
                <span className={styles.trendingMeta}>
                  <b>{outfit.celebrity}</b>
                  <span><s>{inr.format(outfit.worn)}</s><em>{inr.format(outfit.swap)}</em></span>
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
              {outfitOccasions.map((occasion) => (
                <FilterOption
                  key={occasion}
                  selected={occasions.includes(occasion)}
                  count={outfits.filter((outfit) => outfit.occasion === occasion).length}
                  onClick={() => { setOccasions(toggleValue(occasions, occasion)); resetShown(); }}
                >{occasion}</FilterOption>
              ))}
            </FilterGroup>

            <FilterGroup title="Celebrity" onClear={() => { setCelebrities([]); resetShown(); }}>
              {outfitCelebrities.map((celebrity, index) => (
                <FilterOption
                  key={celebrity}
                  selected={celebrities.includes(celebrity)}
                  count={outfits.filter((outfit) => outfit.celebrity === celebrity).length}
                  avatar={`https://picsum.photos/seed/cpc${index}/60/60`}
                  onClick={() => { setCelebrities(toggleValue(celebrities, celebrity)); resetShown(); }}
                >{celebrity}</FilterOption>
              ))}
            </FilterGroup>

            <div className={styles.filterGroup}>
              <h3>Max swap price</h3>
              <div className={styles.range}>
                <input
                  type="range"
                  min="1000"
                  max="8000"
                  step="500"
                  value={budget}
                  aria-label="Maximum swap price"
                  onChange={(event) => { setBudget(Number(event.target.value)); resetShown(); }}
                />
                <div><span>₹1,000</span><b>{budget >= 8000 ? "Any" : inr.format(budget)}</b></div>
              </div>
            </div>

            <FilterGroup title="Minimum saving">
              {savingThresholds.map((threshold) => (
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
                      saved={saved.includes(outfit.id)}
                      onSave={() => setSaved(saved.includes(outfit.id) ? saved.filter((id) => id !== outfit.id) : [...saved, outfit.id])}
                      onNavigate={() => router.push(`/outfits/${outfitSlug(outfit)}`)}
                      onQuickView={() => openQuickView(outfit)}
                    />
                    {index === 4 && <PromoCard />}
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

function FilterGroup({ title, onClear, children }: { title: string; onClear?: () => void; children: React.ReactNode }) {
  return (
    <div className={styles.filterGroup}>
      <h3>{title}{onClear && <button type="button" onClick={onClear}>Clear</button>}</h3>
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
  return (
    <article
      className={`${styles.card} ${featured ? styles.featured : ""}`}
      tabIndex={0}
      onClick={onNavigate}
      onKeyDown={(event) => { if (event.key === "Enter") onNavigate(); }}
    >
      <div className={styles.cardImage}>
        <Image
          src={`https://picsum.photos/seed/cpo${outfit.id}/${featured ? "900/760" : "600/750"}`}
          alt={`${outfit.celebrity} at ${outfit.event}`}
          fill
          sizes={featured ? "(max-width: 1023px) 100vw, 55vw" : "(max-width: 700px) 50vw, 30vw"}
        />
        {featured ? <span className={styles.featuredLabel}>Look of the week</span> : (
          <>
            <div className={styles.badges}>
              <span>{shortDate(outfit.date)}</span>
              {outfit.isNew && <b>New</b>}
              {percentage >= 97 && <em>Top swap</em>}
            </div>
            <span className={styles.occasion}>{outfit.occasion}</span>
            <span className={styles.saving}>−{percentage}%</span>
            <div className={styles.peek}>
              {outfit.items.slice(0, 3).map((item) => <span key={item.name}>{item.name}<b>{inr.format(item.swap)}</b></span>)}
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
        <p>{outfit.event}{featured && ` · ${outfit.items.length} pieces identified`}</p>
        <div className={styles.prices}><s>{inr.format(outfit.worn)}</s><b>{inr.format(outfit.swap)}</b></div>
        {!featured && <span className={styles.savingBar}><i style={{ width: `${percentage}%` }} /></span>}
      </div>
    </article>
  );
}

function PromoCard() {
  return (
    <article className={styles.promo}>
      <span>Shop by wallet</span>
      <h2>Under<br />₹2,000</h2>
      <p>64 complete looks you can build for less than a dinner out.</p>
      <b>Browse →</b>
    </article>
  );
}

function QuickView({ outfit, mode, onModeChange, onClose }: { outfit: Outfit; mode: PriceMode; onModeChange: (mode: PriceMode) => void; onClose: () => void }) {
  return (
    <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="quick-view-title">
      <div className={styles.modalImage}>
        <Image src={`https://picsum.photos/seed/cpo${outfit.id}/700/900`} alt={`${outfit.celebrity} at ${outfit.event}`} fill sizes="(max-width: 800px) 94vw, 540px" />
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
              <div>{item.name}<small>{mode === "worn" ? item.wornBrand : item.swapBrand}</small></div>
              <b>{inr.format(mode === "worn" ? item.worn : item.swap)}</b>
            </div>
          ))}
        </div>
        <div className={styles.modalTotal}><span>{mode === "worn" ? "Total as worn" : "Total for the swap"}</span><b>{inr.format(mode === "worn" ? outfit.worn : outfit.swap)}</b></div>
        <Link className={`${styles.button} ${styles.primaryButton}`} href={`/outfits/${outfitSlug(outfit)}`}>See full breakdown →</Link>
      </div>
    </div>
  );
}
