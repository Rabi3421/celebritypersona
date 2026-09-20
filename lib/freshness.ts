/** Shared price-freshness policy for public copy and the admin review queue. */

const DAY = 86_400_000;

export const CURRENT_PRICE_DAYS = 7;
export const PRICE_REVIEW_DAYS = 15;

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

  if (ageDays < PRICE_REVIEW_DAYS) {
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
