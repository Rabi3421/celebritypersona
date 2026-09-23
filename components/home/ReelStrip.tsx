import Image from "next/image";
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
 * The account's reels, on our own thumbnails, opening on Instagram.
 *
 * This used to play the reel in a dialog on the page, with the `<video>`
 * element pointed straight at the MP4 the Graph API returned. That file lives
 * on `cdninstagram`/`fbcdn` and the URL is signed and short-lived, so every
 * visitor's browser fetched a video from Meta's CDN against a link that would
 * eventually stop working — and the site's own CSP had to name Meta's hosts
 * for `media-src` to allow it.
 *
 * Cards now link to the permalink, which is where a reel is meant to be
 * watched and where its view count and comments are real. Nothing here
 * reaches Instagram's CDN, so the player, its focus trap and the scroll lock
 * are gone with it — there is no dialog left to manage. The component is a
 * server component again as a result.
 */
export function ReelStrip({ reels }: { reels: InstagramReel[] }) {
  return (
    <div className="social">
      {reels.map((reel, i) => (
        <a
          className={`reel ${revealClass(i)}`}
          href={reel.permalink}
          target="_blank"
          rel="noopener noreferrer"
          key={reel.id}
        >
          <Image
            className="home-cover"
            src={reel.thumbnail}
            alt={reel.caption || "Reel from @celebritypersona"}
            fill
            sizes="(max-width: 700px) 33vw, 17vw"
          />
          {posted(reel.postedAt) ? <span className="vw">{posted(reel.postedAt)}</span> : null}
          <span className="play">
            <PlayIcon />
          </span>
          {reel.caption ? <p className="cap">{reel.caption}</p> : null}
        </a>
      ))}
    </div>
  );
}
