import { NextResponse } from "next/server";
import { getAllOutfits } from "@/lib/db/content";
import { recordLinkClick } from "@/lib/db/mutations";
import { outfitSlug } from "@/lib/slugs";
import { isBuyable, isMonetised, linkTarget, pieceLink, type PieceSide } from "@/lib/types";

/**
 * Every outbound click on a retailer link.
 *
 * Going through here rather than linking straight out buys three things: the
 * affiliate form of a URL can be swapped in without editing the page, a click
 * can be counted, and a link that has gone dead stops being offered in one
 * place rather than in every component that renders one.
 *
 * The destination is read from the stored piece and from nothing else. There
 * is deliberately no `url` parameter and no encoded target: a redirector that
 * takes its destination from the query string is an open redirect, and an open
 * redirect on a domain readers are learning to trust is worth more to somebody
 * phishing them than it is to us. The only inputs are which piece and which
 * side, and both are looked up.
 */

/** Read to skip logging, never stored. Counting crawlers as readers would
 *  make the revenue screen describe traffic that cannot buy anything. */
const BOT = /bot|crawl|spider|slurp|bingpreview|headless|python-requests|curl|wget|facebookexternalhit|embedly|preview/i;

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ pieceId: string }> };

/** A path on this site, or null. Never an absolute URL, so the value cannot
 *  be steered into naming somebody else's site as the source. */
function samePath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value.split(/[?#]/)[0];
  return null;
}

export async function GET(request: Request, { params }: Params) {
  const { pieceId } = await params;
  const url = new URL(request.url);
  const home = new URL("/", url).toString();

  const side: PieceSide = url.searchParams.get("side") === "original" ? "original" : "swap";

  const outfits = await getAllOutfits();
  const outfit = outfits.find((candidate) => candidate.items.some((item) => item.id === pieceId));
  const piece = outfit?.items.find((item) => item.id === pieceId);

  if (!outfit || !piece) {
    // A piece that has been deleted or renumbered. Nothing to send anybody to.
    return NextResponse.redirect(home, 302);
  }

  const slug = outfitSlug(outfit);
  const look = new URL(`/outfits/${slug}`, url).toString();
  const link = pieceLink(piece, side);

  // Not buyable covers pending, sold out and dead. The page should not have
  // drawn a button at all, so this is a stale tab or a guessed URL: send the
  // reader to the look, where the current state is shown honestly.
  if (!isBuyable(link)) return NextResponse.redirect(look, 302);

  const target = linkTarget(link);

  /**
   * The stored value still has to be a web URL. An editor can paste anything
   * into the affiliate box, and `javascript:` or `data:` in a Location header
   * is not something to find out about later.
   */
  let destination: URL;
  try {
    destination = new URL(target);
    if (destination.protocol !== "https:" && destination.protocol !== "http:") {
      return NextResponse.redirect(look, 302);
    }
  } catch {
    return NextResponse.redirect(look, 302);
  }

  const agent = request.headers.get("user-agent") ?? "";
  if (!BOT.test(agent)) {
    await recordLinkClick({
      at: new Date().toISOString(),
      outfitId: outfit.id,
      outfitSlug: slug,
      pieceId,
      piece: piece.name,
      side,
      retailer: link.retailer,
      network: link.network,
      sourcePage:
        samePath(url.searchParams.get("from")) ??
        samePath(samePath(request.headers.get("referer")) ?? refererPath(request)) ??
        `/outfits/${slug}`,
      affiliate: isMonetised(link),
    });
  }

  const response = NextResponse.redirect(destination.toString(), 302);
  // Nothing about an outbound click should be cached: the affiliate URL can
  // change under it, and a cached 302 would keep sending people to the old one.
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

/** The path part of a same-origin Referer, when the browser sent a full URL. */
function refererPath(request: Request): string | null {
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    const url = new URL(referer);
    const self = new URL(request.url);
    return url.origin === self.origin ? url.pathname : null;
  } catch {
    return null;
  }
}
