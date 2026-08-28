"use client";

import { useEffect, useRef, useState } from "react";
import { inr } from "@/lib/format";
import { useReducedMotion } from "@/lib/use-reduced-motion";

type Props = {
  from: number;
  to: number;
  className?: string;
  /** Pause before the roll starts, so the number is readable first. */
  delay?: number;
  duration?: number;
};

/** Counts a rupee figure down from the as-worn price to the swap price the
 *  first time it scrolls into view. */
export function RollingTotal({
  from,
  to,
  className,
  delay = 700,
  duration = 1500,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [amount, setAmount] = useState(from);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    let timer = 0;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        if (reduced) {
          setAmount(to);
          return;
        }

        timer = window.setTimeout(() => {
          let start: number | null = null;
          const step = (now: number) => {
            start ??= now;
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            setAmount(from + (to - from) * eased);
            if (progress < 1) frame = requestAnimationFrame(step);
          };
          frame = requestAnimationFrame(step);
        }, delay);
      },
      { threshold: 0.4 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [from, to, delay, duration, reduced]);

  return (
    <span className={className} ref={ref}>
      {inr(amount)}
    </span>
  );
}
