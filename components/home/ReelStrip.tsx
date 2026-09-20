"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PlayIcon } from "@/components/site/Icons";
import { revealClass } from "@/lib/reveal";
import type { InstagramReel } from "@/lib/instagram";

/** How long ago a reel went up. Real, and read off the post itself. */
function posted(timestamp: string) {
  if (!timestamp) return "";
  const then = Date.parse(timestamp);
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/**
 * The account's reels, played where the reader already is.
 *
 * The Graph API hands back the MP4 alongside the thumbnail, so a card opens a
 * player on the page rather than posting the reader off to Instagram. A reel
 * the API gave no file for still links out, and the permalink is always one
 * click away inside the player.
 */
export function ReelStrip({ reels }: { reels: InstagramReel[] }) {
  const [playing, setPlaying] = useState<InstagramReel | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!playing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlaying(null);
    };
    window.addEventListener("keydown", onKeyDown);
    // The page behind a full-screen player must not scroll under it.
    const held = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = held;
      previousFocus.current?.focus();
      previousFocus.current = null;
    };
  }, [playing]);

  function openReel(reel: InstagramReel) {
    previousFocus.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setPlaying(reel);
  }

  function keepFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialog.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <div className="social">
        {reels.map((reel, i) => {
          const inside = (
            <>
              <Image
                className="home-cover"
                src={reel.thumbnail}
                alt={reel.caption || "Reel from @celebritypersona"}
                fill
                sizes="(max-width: 700px) 33vw, 17vw"
              />
              {posted(reel.postedAt) ? <span className="vw">{posted(reel.postedAt)}</span> : null}
              <span className="play"><PlayIcon /></span>
              {reel.caption ? <p className="cap">{reel.caption}</p> : null}
            </>
          );

          return reel.video ? (
            <button
              type="button"
              className={`reel ${revealClass(i)}`}
              key={reel.id}
              aria-label={`Play reel${reel.caption ? `: ${reel.caption}` : ""}`}
              onClick={() => openReel(reel)}
            >
              {inside}
            </button>
          ) : (
            <a
              className={`reel ${revealClass(i)}`}
              href={reel.permalink}
              target="_blank"
              rel="noopener"
              key={reel.id}
            >
              {inside}
            </a>
          );
        })}
      </div>

      {playing ? (
        <div
          ref={dialog}
          className="reel-stage"
          role="dialog"
          aria-modal="true"
          aria-label="Reel player"
          onClick={() => setPlaying(null)}
          onKeyDown={keepFocus}
        >
          <div className="reel-stage-box" onClick={(event) => event.stopPropagation()}>
            <video
              key={playing.id}
              src={playing.video}
              poster={playing.thumbnail}
              controls
              autoPlay
              playsInline
              preload="metadata"
            />
            <div className="reel-stage-foot">
              {playing.caption ? <p>{playing.caption}</p> : <span />}
              <a href={playing.permalink} target="_blank" rel="noopener noreferrer">
                Watch on Instagram →
              </a>
            </div>
          </div>
          <button
            type="button"
            className="reel-stage-close"
            data-autofocus
            aria-label="Close player"
            onClick={() => setPlaying(null)}
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}
