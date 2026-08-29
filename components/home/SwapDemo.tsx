"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { inr } from "@/lib/format";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import type { HomeContent } from "@/lib/types";

type Mode = "worn" | "swap";

const ROLL_MS = 520;
const ROW_STAGGER_MS = 60;
const BRAND_FADE_MS = 200;
const SAVING_DELAY_MS = 340;

/** Side-by-side of the look as worn and the look as you can afford it.
 *  Auto-plays the swap once when it first scrolls into view. */
export function SwapDemo({
  heroLook,
  swapSteps,
}: {
  heroLook: HomeContent["heroLook"];
  swapSteps: HomeContent["swapSteps"];
}) {
  const ITEMS = heroLook.items;
  // Memoised so the roll callback below keeps a stable identity.
  const totals = useMemo(
    () => ({
      worn: ITEMS.reduce((sum, item) => sum + item.worn, 0),
      swap: ITEMS.reduce((sum, item) => sum + item.swap, 0),
    }),
    [ITEMS],
  );
  const saving = totals.worn - totals.swap;
  const savingPercent = ((saving / totals.worn) * 100).toFixed(1);
  const totalFor = useCallback(
    (mode: Mode) => (mode === "worn" ? totals.worn : totals.swap),
    [totals],
  );

  const [mode, setMode] = useState<Mode>("worn");
  const [prices, setPrices] = useState<number[]>(ITEMS.map((item) => item.worn));
  const [total, setTotal] = useState(totals.worn);
  const [brandMode, setBrandMode] = useState<Mode>("worn");
  const [brandsVisible, setBrandsVisible] = useState(true);
  const [savingShown, setSavingShown] = useState(false);

  const reduced = useReducedMotion();
  const toggleRef = useRef<HTMLDivElement>(null);

  // Refs mirror state so the animation can read current values without being
  // re-created on every frame.
  const modeRef = useRef<Mode>("worn");
  const reducedRef = useRef(reduced);
  const pricesRef = useRef(prices);
  const totalRef = useRef(total);
  const pending = useRef({ frames: new Set<number>(), timers: new Set<number>() });

  useEffect(() => {
    reducedRef.current = reduced;
    pricesRef.current = prices;
    totalRef.current = total;
  });

  const clearPending = useCallback(() => {
    pending.current.frames.forEach(cancelAnimationFrame);
    pending.current.timers.forEach(clearTimeout);
    pending.current.frames.clear();
    pending.current.timers.clear();
  }, []);

  useEffect(() => clearPending, [clearPending]);

  const changeMode = useCallback(
    (next: Mode) => {
      if (modeRef.current === next) return;
      modeRef.current = next;
      setMode(next);

      // Reduced motion skips the animation; the render below reads the target
      // values straight off `mode`.
      if (reducedRef.current) return;

      clearPending();
      const { frames, timers } = pending.current;

      const roll = (
        from: number,
        to: number,
        delay: number,
        apply: (value: number) => void,
      ) => {
        timers.add(
          window.setTimeout(() => {
            let start: number | null = null;
            const step = (now: number) => {
              start ??= now;
              const progress = Math.min((now - start) / ROLL_MS, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              apply(from + (to - from) * eased);
              if (progress < 1) frames.add(requestAnimationFrame(step));
            };
            frames.add(requestAnimationFrame(step));
          }, delay),
        );
      };

      const fromPrices = pricesRef.current;
      ITEMS.forEach((item, i) => {
        roll(fromPrices[i], item[next], i * ROW_STAGGER_MS, (value) => {
          setPrices((prev) => {
            const updated = prev.slice();
            updated[i] = value;
            return updated;
          });
        });
      });
      roll(totalRef.current, totalFor(next), 0, setTotal);

      setBrandsVisible(false);
      timers.add(
        window.setTimeout(() => {
          setBrandMode(next);
          setBrandsVisible(true);
        }, BRAND_FADE_MS),
      );
      timers.add(
        window.setTimeout(
          () => setSavingShown(next === "swap"),
          SAVING_DELAY_MS,
        ),
      );
    },
    [clearPending, ITEMS, totalFor],
  );

  // Play the swap once, unprompted, the first time the toggle is on screen.
  useEffect(() => {
    const el = toggleRef.current;
    if (!el) return;

    let timer = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        timer = window.setTimeout(() => changeMode("swap"), 900);
      },
      { threshold: 0.55 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [changeMode]);

  const shownPrices = reduced ? ITEMS.map((item) => item[mode]) : prices;
  const shownTotal = reduced ? totalFor(mode) : total;
  const shownBrandMode = reduced ? mode : brandMode;
  const shownBrandOpacity = reduced || brandsVisible ? 1 : 0;
  const shownSaving = reduced ? mode === "swap" : savingShown;

  return (
    <section className="sec alt">
      <div className="shell">
        <div className="demo">
          <div className="demo-vis rv">
            <div className="dtoggle" data-m={mode} ref={toggleRef} role="tablist">
              <div className="dthumb" />
              <button
                type="button"
                role="tab"
                aria-selected={mode === "worn"}
                onClick={() => changeMode("worn")}
              >
                As worn
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "swap"}
                onClick={() => changeMode("swap")}
              >
                The swap
              </button>
            </div>

            <div>
              {ITEMS.map((item, i) => (
                <div className="drow" key={item.name}>
                  <div className="l">
                    <div className="n">{item.name}</div>
                    <div className="b" style={{ opacity: shownBrandOpacity }}>
                      {shownBrandMode === "worn"
                        ? item.wornBrand
                        : item.swapBrand}
                    </div>
                  </div>
                  <div className="p mono">{inr(shownPrices[i])}</div>
                </div>
              ))}
            </div>

            <div className="dtot">
              <span className="l">
                {mode === "worn" ? "Total as worn" : "Total for the swap"}
              </span>
              <span className="v mono">{inr(shownTotal)}</span>
            </div>
            <div className={shownSaving ? "dsave on" : "dsave"}>
              You save {inr(saving)} — {savingPercent}% less
            </div>
          </div>

          <div className="demo-copy rv rv-d2">
            <h2>Everyone shows you the price. We show you the alternative.</h2>
            <p>
              Other sites tell you the bag cost ₹5,86,000 and stop there.
              That&apos;s a fun fact, not a shopping decision.
            </p>
            <p>
              Every look on this site gets decoded twice — once as she wore it,
              once as you can afford it.
            </p>
            <div className="demo-steps">
              {swapSteps.map((step) => (
                <div className="dstep" key={step.n}>
                  <span className="n">{step.n}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
