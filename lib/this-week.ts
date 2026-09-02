import { hasSwap, outfitPhoto, pricing, type Outfit } from "@/lib/types";
import { outfitSlug } from "@/lib/slugs";

/**
 * "Decoded this week" used to be seven rows an editor retyped by hand in the
 * homepage form, which meant the rail said whatever it said the last time
 * somebody remembered to update it. It is now read off the outfits themselves:
 * publish a look in the admin panel and it appears here.
 */

/** How recent a look has to be to count as this week's. */
const WINDOW_DAYS = 7;
/** The homepage lays these out in one row rather than scrolling them, so it
 *  shows what fits and sends the reader to /outfits for the rest. */
const MAX_CARDS = 5;
/** A near-empty rail reads as a broken page, so a quiet week falls back to the
 *  newest looks regardless of their date. */
const MIN_CARDS = 4;

/** The five placeholder gradients the card CSS defines, cycled by position. */
const TONES = ["", "v2", "v3", "v4", "v5"] as const;

export type WeekCard = {
  slug: string;
  celebrity: string;
  event: string;
  posted: string;
  tone: (typeof TONES)[number];
  image?: string;
  /** Null when no piece on the look has a confirmed original price. */
  worn: number | null;
  /** Null until at least one piece has an alternative. */
  swap: number | null;
  peek: { label: string; price: number }[];
};

const DAY = 86_400_000;

/** Whole days between two YYYY-MM-DD days, counted in UTC so a timezone can
 *  never turn today's look into tomorrow's. */
const daysAgo = (date: string, now: Date) => {
  const then = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((today - then) / DAY);
};

const posted = (days: number) => {
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
};

function toCard(outfit: Outfit, index: number, now: Date): WeekCard {
  const money = pricing(outfit);
  return {
    slug: outfitSlug(outfit),
    celebrity: outfit.celebrity,
    event: outfit.event,
    posted: posted(daysAgo(outfit.date, now)),
    tone: TONES[index % TONES.length],
    image: outfitPhoto(outfit)?.url,
    worn: money.anyPriced ? money.wornTotal : null,
    swap: money.anySwapped ? money.swapTotal : null,
    // The hover strip is the cheapest way to buy the look, so it lists the
    // pieces that actually have an alternative — the priciest swaps first,
    // since those are the ones worth stopping for.
    peek: outfit.items
      .filter(hasSwap)
      .sort((a, b) => b.swap - a.swap)
      .slice(0, 3)
      .map((item) => ({ label: item.name, price: item.swap })),
  };
}

export type ThisWeek = {
  cards: WeekCard[];
  /** Looks published inside the window, whether or not they all fit the rail. */
  count: number;
  /** True when the window was too quiet to fill the rail and older looks were
   *  pulled in, so the blurb can stop claiming they are this week's. */
  fellBack: boolean;
};

export function thisWeekFrom(outfits: Outfit[], now = new Date()): ThisWeek {
  const newestFirst = [...outfits].sort((a, b) => b.date.localeCompare(a.date));
  const recent = newestFirst.filter((outfit) => daysAgo(outfit.date, now) < WINDOW_DAYS);
  const fellBack = recent.length < MIN_CARDS;
  const chosen = (fellBack ? newestFirst : recent).slice(0, MAX_CARDS);

  return {
    cards: chosen.map((outfit, index) => toCard(outfit, index, now)),
    count: recent.length,
    fellBack,
  };
}
