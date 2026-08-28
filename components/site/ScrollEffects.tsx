"use client";

import { useEffect, useRef } from "react";

/**
 * Page-level scroll behaviour, kept in one client component so the rest of the
 * page can stay server-rendered:
 *  - the reading-progress bar it renders
 *  - the condensed `stuck` state on the sticky nav
 *  - the `.in` class that plays the reveal animations
 *  - Enter-key activation on the placeholder tiles
 *
 * The tile wiring goes away once cards link to real outfit routes.
 */
export function ScrollEffects() {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const progress = progressRef.current;
    const nav = document.getElementById("nav");
    let queued = false;

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        const scrollable = document.body.scrollHeight - window.innerHeight;
        const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
        if (progress) progress.style.width = `${ratio * 100}%`;
        nav?.classList.toggle("stuck", window.scrollY > 80);
        queued = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("in");
          reveal.unobserve(entry.target);
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -40px 0px" },
    );
    document
      .querySelectorAll(".rv, .titem, .stat")
      .forEach((el) => reveal.observe(el));

    const onTileKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      (event.currentTarget as HTMLElement).click();
    };
    const tiles = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".card, .btile, .otile, .ctile, .reel",
      ),
    );
    tiles.forEach((tile) => {
      tile.setAttribute("tabindex", "0");
      tile.addEventListener("keydown", onTileKey);
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      reveal.disconnect();
      tiles.forEach((tile) => tile.removeEventListener("keydown", onTileKey));
    };
  }, []);

  return <div className="prog" ref={progressRef} aria-hidden="true" />;
}
