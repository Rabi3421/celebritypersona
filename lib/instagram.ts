import "server-only";

/**
 * The reels the account has actually posted.
 *
 * This used to read the Graph API at render time and hand Instagram's own URLs
 * straight to the page. Two things were wrong with that. The thumbnails are
 * signed `scontent-*.cdninstagram.com` links that expire in a matter of days,
 * so the homepage's images were only ever as fresh as the last revalidation
 * and would start 403-ing the moment one lapsed. And the player hotlinked the
 * MP4 directly from `cdninstagram`/`fbcdn`, so every visitor's browser fetched
 * a video file from Meta's CDN — which meant the site's own content-security
 * policy had to name those hosts and a reader's request went to Meta whether
 * they had anything to do with Instagram or not.
 *
 * Now the Graph read happens out of band, in `npm run instagram:mirror`, which
 * stores each thumbnail in our own bucket and writes the metadata to
 * `siteContent/reels`. The page renders those, and links out to the permalink.
 * Nothing on the page points at Instagram's CDN, and an expired token stops
 * updates rather than blanking the section.
 *
 * The trade is that a reel deleted on Instagram stays on the site until the
 * mirror runs again, and the reel no longer plays in place.
 */

const GRAPH = "https://graph.instagram.com/v23.0";

/** A reel as the site stores and renders it. */
export type InstagramReel = {
  id: string;
  /** The first line of the post's caption, or an empty string. */
  caption: string;
  permalink: string;
  /** Our own copy, in Firebase Storage. Never an Instagram URL. */
  thumbnail: string;
  /** Storage path, so a later mirror run can replace or remove the file. */
  thumbnailPath: string;
  /** ISO timestamp, for the "3 days ago" badge. */
  postedAt: string;
};

/** What the Graph API hands back, before anything is mirrored. */
export type InstagramSource = {
  id: string;
  caption: string;
  permalink: string;
  /** Signed, short-lived, and never rendered — only fetched by the mirror. */
  thumbnailUrl: string;
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

export const instagramConfigured = () => Boolean(process.env.INSTAGRAM_ACCESS_TOKEN);

/** One line, short enough to sit across the bottom of a card. */
function firstLine(caption: string | undefined) {
  const line = caption?.split("\n").map((part) => part.trim()).find(Boolean) ?? "";
  // Hashtag tails read as noise in a caption strip.
  const clean = line.replace(/(^|\s)#[^\s#]+/g, "").replace(/\s+/g, " ").trim();
  const text = clean || line;
  return text.length > 74 ? `${text.slice(0, 71).trimEnd()}…` : text;
}

/**
 * Reads the account's reels from the Graph API.
 *
 * Only the mirror script calls this. Nothing rendered should: the URLs it
 * returns expire, and they point at Meta rather than at us.
 *
 * Every failure is reported as an empty list, so a lapsed token or a Meta
 * outage leaves whatever is already mirrored standing.
 */
export async function fetchInstagramReels(limit = 6): Promise<InstagramSource[]> {
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
    const response = await fetch(url, { cache: "no-store" });
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
        thumbnailUrl: (node.thumbnail_url ?? node.media_url) as string,
        postedAt: node.timestamp ?? "",
      }));
  } catch (error) {
    console.error("Instagram media request threw", error);
    return [];
  }
}
