"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!playing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlaying(null);
    };
    window.addEventListener("keydown", onKeyDown);
    // The page behind a full-screen player must not scroll under it.
    const held = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = held;
    };
  }, [playing]);

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
              onClick={() => setPlaying(reel)}
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
          className="reel-stage"
          role="dialog"
          aria-modal="true"
          aria-label="Reel player"
          onClick={() => setPlaying(null)}
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
              <a href={playing.permalink} target="_blank" rel="noopener">
                Watch on Instagram →
              </a>
            </div>
          </div>
          <button
            type="button"
            className="reel-stage-close"
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
