/** Shared price-freshness policy for public copy and the admin review queue. */

import { REVIEW_WINDOW_DAYS } from "@/lib/thresholds";
import type { Outfit } from "@/lib/types";

const DAY = 86_400_000;

export const CURRENT_PRICE_DAYS = 7;

/** Re-exported under its old name so nothing that imports it has to move. The
 *  number itself now lives with the other tunable thresholds. */
export const PRICE_REVIEW_DAYS = REVIEW_WINDOW_DAYS;

/** The later of two YYYY-MM-DD days, either of which may be absent. */
const later = (a: string | undefined, b: string | undefined) =>
  !a ? b : !b ? a : a > b ? a : b;

/**
 * When this look was last actually verified.
 *
 * `pricesCheckedAt` is set when an editor saves, and it was the only input —
 * so a look whose links `check:links` had confirmed an hour ago still read as
 * unverified from weeks back. Every link now carries its own `checkedAt`, and
 * the freshest of those counts too: a machine confirming the product page is
 * still there is a real check, even though it is not a person re-reading the
 * price.
 */
export function lastCheckedAt(outfit: Outfit): string | undefined {
  const fromLinks = outfit.items.flatMap((item) =>
    [item.wornLink?.checkedAt, item.swapLink?.checkedAt].filter(Boolean),
  ) as string[];
  return fromLinks.reduce<string | undefined>(later, outfit.pricesCheckedAt);
}

export type FreshnessTone = "current" | "aging" | "overdue" | "unknown";

export type PriceFreshness = {
  tone: FreshnessTone;
  ageDays: number | null;
  label: string;
  warning: string;
};

/** Counts calendar days in UTC so the result does not change with server timezone. */
export function priceFreshness(value: string | null | undefined, now = new Date()): PriceFreshness {
  if (!value) {
    return {
      tone: "unknown",
      ageDays: null,
      label: "Not yet verified",
      warning: "Price and availability have not yet been verified.",
    };
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const checked = match
    ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : Number.NaN;
  const checkedDate = new Date(checked);
  const valid =
    match !== null &&
    checkedDate.getUTCFullYear() === Number(match[1]) &&
    checkedDate.getUTCMonth() === Number(match[2]) - 1 &&
    checkedDate.getUTCDate() === Number(match[3]);
  if (!valid) {
    return {
      tone: "unknown",
      ageDays: null,
      label: "Verification date unavailable",
      warning: "Price and availability need verification.",
    };
  }

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (checked > today) {
    return {
      tone: "unknown",
      ageDays: null,
      label: "Verification date needs correction",
      warning: "The recorded verification date is in the future.",
    };
  }

  const ageDays = Math.floor((today - checked) / DAY);

  if (ageDays <= CURRENT_PRICE_DAYS) {
    return {
      tone: "current",
      ageDays,
      label: "Recently checked",
      warning: "Price and availability were checked recently.",
    };
  }

  if (ageDays < REVIEW_WINDOW_DAYS) {
    return {
      tone: "aging",
      ageDays,
      label: "Recheck recommended",
      warning: "The retailer may have changed the price or availability since our last check.",
    };
  }

  return {
    tone: "overdue",
    ageDays,
    label: "Verification overdue",
    warning: "Price and availability may have changed; confirm them on the retailer site.",
  };
}

export const needsPriceReview = (value: string | null | undefined, now = new Date()) =>
  ["overdue", "unknown"].includes(priceFreshness(value, now).tone);
