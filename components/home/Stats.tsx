"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import type { HomeStat } from "@/lib/archive";

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
  const [shown, setShown] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        if (reduced) {
          setShown(value);
          return;
        }

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

    observer.observe(el);
    return () => {
      observer.disconnect();
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
