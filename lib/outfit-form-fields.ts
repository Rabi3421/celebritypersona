import { indexedRows, rows, text } from "@/lib/form-data";

/**
 * The outfit form's posted fields, read the one way — by the save action, and
 * by the browser when it restores an autosaved draft — so a restored draft is
 * exactly what a rejected save would have echoed back.
 */

/** Exactly what the form posted, echoed back so a rejected save keeps the
 *  typing. React resets an uncontrolled form after every action. */
export type OutfitDraft = {
  celebrity: string;
  event: string;
  occasion: string;
  /** The other occasions, comma-separated as typed. */
  occasions: string;
  date: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  photoCredit: string;
  images: { url: string; path: string; alt?: string; credit?: string }[];
  notes: string;
  items: Record<string, string>[];
  status: string;
  primaryKeyword: string;
  /** Comma-separated as posted by the chips input. */
  secondaryKeywords: string;
  faqs: Record<string, string>[];
  /** The form index of the row picked as the lead piece. */
  leadPiece: string;
};


export const IMAGE_FIELDS = ["url", "path", "alt", "credit"];

/**
 * Every key a piece row posts. `rows()` reads only what is listed here, so a
 * field the form sends but this list omits is silently dropped on save — which
 * is how every save used to wipe a piece's retailer, affiliate link, network
 * and status, and hand it a new id that orphaned its click history.
 */
export const ITEM_FIELDS = [
  "id",
  "name",
  "wornBrand",
  "worn",
  "wornUrl",
  "wornRetailer",
  "wornAffiliateUrl",
  "wornNetwork",
  "wornStatus",
  "swapBrand",
  "swap",
  "swapUrl",
  "swapRetailer",
  "swapAffiliateUrl",
  "swapNetwork",
  "swapStatus",
  "note",
  "soldOut",
  "hotspotX",
  "hotspotY",
  "category",
  "colours",
];

/**
 * Keys that always post something: the selects fall back to their first option
 * and the id is carried unchanged. A row with nothing but these is a blank row
 * somebody added and left, and is skipped exactly as it was before they posted.
 */
export const PREFILLED = new Set(["id", "wornNetwork", "wornStatus", "swapNetwork", "swapStatus"]);

export const hasTypedValue = (row: Record<string, string>) =>
  Object.entries(row).some(([key, value]) => !PREFILLED.has(key) && value !== "");


/**
 * The lead is a radio naming a row by the index it was posted under. Blank
 * rows are dropped, so the index is translated into a position among the rows
 * that survive — and from there, in the action, into the piece's id.
 */
export const leadPosition = (form: FormData) =>
  indexedRows(form, "items", ITEM_FIELDS)
    .filter((row) => hasTypedValue(row.values))
    .findIndex((row) => String(row.index) === text(form, "leadPiece"));

/** Everything the form posted, as the draft that re-renders it. */
export function readOutfitDraft(form: FormData): OutfitDraft {
  const draft: OutfitDraft = {
    celebrity: text(form, "celebrity"),
    event: text(form, "event"),
    occasion: text(form, "occasion"),
    occasions: text(form, "occasions"),
    date: text(form, "date"),
    slug: text(form, "slug"),
    seoTitle: text(form, "seoTitle"),
    seoDescription: text(form, "seoDescription"),
    photoCredit: text(form, "photoCredit"),
    images: rows(form, "images", IMAGE_FIELDS) as OutfitDraft["images"],
    notes: text(form, "notes"),
    items: rows(form, "items", ITEM_FIELDS).filter(hasTypedValue),
    status: text(form, "status"),
    primaryKeyword: text(form, "primaryKeyword"),
    secondaryKeywords: text(form, "secondaryKeywords"),
    faqs: rows(form, "faqs", ["question", "answer"]),
    leadPiece: text(form, "leadPiece"),
  };
  // Echoed on the row itself, so the draft reopens with the same lead.
  const lead = leadPosition(form);
  if (lead >= 0) draft.items[lead] = { ...draft.items[lead], leadPiece: "on" };
  return draft;
}
