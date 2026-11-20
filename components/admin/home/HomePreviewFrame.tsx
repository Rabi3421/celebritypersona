"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { CampaignBand } from "@/components/home/CampaignBand";
import { Stats } from "@/components/home/Stats";
import { SwapDemo } from "@/components/home/SwapDemo";
import { TrustSection } from "@/components/home/TrustSection";
import type { HeroLook, HomeStat } from "@/lib/archive";
import { PREVIEW_SIZE_MESSAGE, previewMessage, type StudioSectionId } from "@/lib/home-studio";
import type { HomeContent } from "@/lib/types";
import p from "./preview.module.css";

/**
 * Inside the preview iframe: one homepage section, drawn by the same
 * components the homepage uses, wrapped exactly as app/page.tsx wraps them.
 *
 * Accepts messages only from this origin and only from the page that framed
 * it, in the shape `previewMessage` allows; renders them as React text.
 * Links are inert here — the preview shows the page, it does not navigate.
 */
export function HomePreviewFrame({
  initial,
  hero,
  stats,
  weddingLooks,
  minWeddingLooks,
}: {
  initial: HomeContent;
  hero: HeroLook | null;
  stats: HomeStat[];
  weddingLooks: number;
  minWeddingLooks: number;
}) {
  const [section, setSection] = useState<StudioSectionId>("counters");
  const [content, setContent] = useState<HomeContent>(initial);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== window.parent) return;
      const message = previewMessage(event.data);
      if (!message) return;
      setSection(message.section);
      setContent(message.content);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Tell the studio how tall the section is — the content, not the frame — so it
  // can size the frame to fit, with no scrollbar and no empty band.
  useEffect(() => {
    const el = root.current;
    if (window.parent === window || !el) return;
    const report = () => window.parent.postMessage({ type: PREVIEW_SIZE_MESSAGE, height: el.getBoundingClientRect().height }, location.origin);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const inertLinks = (event: MouseEvent) => {
    if ((event.target as Element).closest("a")) event.preventDefault();
  };

  return (
    <div ref={root} className={p.root} onClickCapture={inertLinks}>
      {section === "automatic" ? (
        <Notice>These sections are counted from published looks and have nothing to edit. Open the homepage to see them.</Notice>
      ) : null}

      {section === "counters" ? (
        <>
          {content.showStats ? null : <Notice>Hidden on the homepage — the counters are switched off. This is how they would look.</Notice>}
          <Stats stats={stats} />
        </>
      ) : null}

      {section === "steps" ? (
        hero ? (
          <SwapDemo heroLook={hero} swapSteps={content.swapSteps} />
        ) : (
          <Notice>Not on the homepage yet: the swap demo, and these steps beside it, appear once a published look has two pieces priced on both sides.</Notice>
        )
      ) : null}

      {section === "campaign" ? (
        <>
          {weddingLooks < minWeddingLooks ? (
            <Notice>
              Hidden on the homepage until there are {minWeddingLooks} published wedding looks (there {weddingLooks === 1 ? "is" : "are"} {weddingLooks}). This is how it will read.
            </Notice>
          ) : null}
          <div className="shell">
            <CampaignBand campaign={content.campaign} looks={weddingLooks} />
          </div>
        </>
      ) : null}

      {section === "trust" ? <TrustSection points={content.trustPoints} /> : null}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className={p.notice} role="note">
      {children}
    </p>
  );
}
