import "server-only";
import { cache } from "react";

/**
 * The reels the account has actually posted.
 *
 * Instagram's Basic Display API was retired in December 2024, so this reads
 * the Graph endpoint that replaced it: an Instagram professional account
 * (Business or Creator), a Meta app, and one long-lived token in the
 * environment. Nothing about a reel is stored here — the section is a window
 * onto the account, so deleting a reel on Instagram removes it from the site
 * at the next revalidation.
 *
 * Every failure is swallowed and reported as an empty list. A token that has
 * expired, a rate limit or a Meta outage must leave the homepage standing.
 */

const GRAPH = "https://graph.instagram.com/v23.0";

/** Instagram's CDN links are signed and expire in a matter of days, so the
 *  page has to re-read them well inside that window. */
const REVALIDATE_SECONDS = 3600;

export type InstagramReel = {
  id: string;
  /** The first line of the post's caption, or an empty string. */
  caption: string;
  permalink: string;
  thumbnail: string;
  /** The MP4 itself, so the reel plays on the page instead of sending the
   *  reader to Instagram. Signed and short-lived, which is the other reason
   *  this is re-read hourly. */
  video: string;
  /** ISO timestamp, for the "3 days ago" badge. */
  postedAt: string;
};

type MediaNode = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  timestamp?: string;
};

export const instagramConfigured = () =>
  Boolean(process.env.INSTAGRAM_ACCESS_TOKEN);

/** One line, short enough to sit across the bottom of a card. */
function firstLine(caption: string | undefined) {
  const line = caption?.split("\n").map((part) => part.trim()).find(Boolean) ?? "";
  // Hashtag tails read as noise in a caption strip.
  const clean = line.replace(/(^|\s)#[^\s#]+/g, "").replace(/\s+/g, " ").trim();
  const text = clean || line;
  return text.length > 74 ? `${text.slice(0, 71).trimEnd()}…` : text;
}

export const getInstagramReels = cache(
  async (limit = 6): Promise<InstagramReel[]> => {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!token) return [];

    const url = new URL(`${GRAPH}/me/media`);
    url.searchParams.set(
      "fields",
      "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp",
    );
    // More than the section shows, because stills are filtered out below.
    url.searchParams.set("limit", "40");
    url.searchParams.set("access_token", token);

    try {
      const response = await fetch(url, {
        next: { revalidate: REVALIDATE_SECONDS, tags: ["instagram"] },
      });
      if (!response.ok) {
        console.error(
          `Instagram media request failed: ${response.status} ${response.statusText}. ` +
            "A 400 here is usually an expired token — run npm run instagram:refresh.",
        );
        return [];
      }

      const body = (await response.json()) as { data?: MediaNode[] };
      return (body.data ?? [])
        // Reels arrive as VIDEO; media_product_type separates them from feed
        // videos on accounts that post both.
        .filter(
          (node) =>
            node.media_type === "VIDEO" &&
            (node.media_product_type ?? "REELS") === "REELS" &&
            node.permalink &&
            (node.thumbnail_url || node.media_url),
        )
        .slice(0, limit)
        .map((node) => ({
          id: node.id,
          caption: firstLine(node.caption),
          permalink: node.permalink as string,
          thumbnail: (node.thumbnail_url ?? node.media_url) as string,
          video: node.media_url ?? "",
          postedAt: node.timestamp ?? "",
        }));
    } catch (error) {
      console.error("Instagram media request threw", error);
      return [];
    }
  },
);
