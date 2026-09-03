"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import type { HomeStat } from "@/lib/archive";

/**
 * A counted figure that animates up when it scrolls into view.
 *
 * It used to start at zero in state, which meant the server-rendered HTML —
 * the only version a crawler is guaranteed to read — said "0 Looks decoded,
 * 0 Pieces identified, 0% Average saving" on the homepage. The real number is
 * now what renders; the roll is applied afterwards, and only to a tile that is
 * still off-screen, so nobody watching sees a number fall to zero first.
 */
/**
 * A counted figure that rolls up when it scrolls into view.
 *
 * It used to start at zero in state, which meant the server-rendered HTML —
 * the only version a crawler is guaranteed to read — said "0 Looks decoded,
 * 0 Pieces identified, 0% Average saving" on the homepage. The real number is
 * what renders now; the roll is applied afterwards and only to a tile still
 * far enough below the fold that nobody watches it drop to zero first.
 */

/** How far below the fold the tile is zeroed, so the reset is never seen. */
const ARM_MARGIN = 400;

function StatTile({
  value,
  suffix,
  label,
}: {
  value: number;
  suffix: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(value);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    // Within a screen of the fold when the page loaded: the reader is looking
    // at the real figure already, so it is left alone rather than reset to
    // animate in front of them.
    if (el.getBoundingClientRect().top < window.innerHeight + ARM_MARGIN) return;

    let frame = 0;

    // Zeroed well before it can be seen, then rolled up when it arrives.
    const arm = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        arm.disconnect();
        setShown(0);
      },
      { rootMargin: `${ARM_MARGIN}px 0px` },
    );

    const roll = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        roll.disconnect();

        const duration = 1500;
        let start: number | null = null;
        const step = (now: number) => {
          start ??= now;
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setShown(Math.round(value * eased));
          if (progress < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.5 },
    );

    arm.observe(el);
    roll.observe(el);
    return () => {
      arm.disconnect();
      roll.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, reduced]);

  return (
    <div className="stat" ref={ref}>
      <p className="v mono">
        {shown.toLocaleString("en-IN")}
        {suffix}
      </p>
      <p className="k">{label}</p>
    </div>
  );
}

export function Stats({ stats }: { stats: HomeStat[] }) {
  return (
    <section className="stats">
      <div className="shell">
        <div className="stats-in">
          {stats.map((stat) => (
            <StatTile
              key={stat.label}
              value={stat.value}
              suffix={stat.suffix}
              label={stat.label}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
