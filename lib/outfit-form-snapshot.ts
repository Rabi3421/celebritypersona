import { csv, indexedRows, lines, rows, text } from "@/lib/form-data";
import type { SeoDraft } from "@/lib/seo-checks";
import { isPieceCategory, isPieceColour } from "@/lib/taxonomy";
import type { OutfitItem } from "@/lib/types";
import type { PieceLinkInput } from "@/lib/seo-review/audit";

/**
 * The outfit form as it stands right now, read out of its FormData.
 *
 * The form's inputs are uncontrolled — the piece rows, the photo editor and the
 * text fields each manage themselves — so the live checklist and the Google
 * preview read what the browser would post rather than holding a second copy
 * of the state. Parsed the way the save action parses it, so the preview and
 * the checks describe what a save would store.
 */
export type OutfitSnapshot = SeoDraft & {
  status: string;
  secondaryKeywords: string[];
  /** Read only by the SEO review panel (lib/seo-review); the checklist ignores them. */
  date: string;
  faqs: { question: string; answer: string }[];
  links: PieceLinkInput[];
};

const LINK_FIELDS = ["name", "wornUrl", "wornStatus", "wornAffiliateUrl", "wornNetwork", "swapUrl", "swapStatus", "swapAffiliateUrl", "swapNetwork"];

/** Each piece's two shop links as the form holds them, for the review's product checks. */
function readLinks(data: FormData): PieceLinkInput[] {
  return indexedRows(data, "items", LINK_FIELDS)
    .filter((row) => row.values.name)
    .flatMap(({ values }) =>
      (["original", "swap"] as const).map((side) => {
        const prefix = side === "original" ? "worn" : "swap";
        return {
          piece: values.name,
          side,
          url: values[`${prefix}Url`] || undefined,
          status: values[`${prefix}Status`] || undefined,
          affiliateUrl: values[`${prefix}AffiliateUrl`] || undefined,
          network: values[`${prefix}Network`] || undefined,
        };
      }),
    )
    .filter((link) => link.url || link.affiliateUrl);
}

const PIECE_FIELDS = ["id", "name", "category", "colours", "wornBrand", "worn", "swapBrand", "swap"];

const money = (value: string) => (/^\d+$/.test(value) && Number(value) > 0 ? Number(value) : undefined);

export function readOutfitSnapshot(form: HTMLFormElement): OutfitSnapshot {
  const data = new FormData(form);
  const lead = text(data, "leadPiece");

  const pieces = indexedRows(data, "items", PIECE_FIELDS).filter((row) => row.values.name);
  const items: OutfitItem[] = pieces.map(({ index, values }) => ({
    // Unsaved rows have no id yet; the row index stands in, so the lead
    // radio can still name one.
    id: values.id || `row-${index}`,
    name: values.name,
    ...(isPieceCategory(values.category) ? { category: values.category } : {}),
    colours: values.colours
      .split(",")
      .map((colour) => colour.trim().toLowerCase())
      .filter(isPieceColour),
    ...(values.wornBrand ? { wornBrand: values.wornBrand } : {}),
    ...(money(values.worn) ? { worn: money(values.worn) } : {}),
    ...(values.swapBrand ? { swapBrand: values.swapBrand } : {}),
    ...(money(values.swap) ? { swap: money(values.swap) } : {}),
  }));
  const chosen = pieces.findIndex((row) => String(row.index) === lead);

  return {
    celebrity: text(data, "celebrity"),
    event: text(data, "event"),
    occasion: text(data, "occasion"),
    occasions: csv(data, "occasions"),
    slug: text(data, "slug"),
    seoTitle: text(data, "seoTitle") || undefined,
    seoDescription: text(data, "seoDescription") || undefined,
    primaryKeyword: text(data, "primaryKeyword") || undefined,
    secondaryKeywords: csv(data, "secondaryKeywords"),
    status: text(data, "status"),
    notes: lines(data, "notes"),
    photoCredit: text(data, "photoCredit") || undefined,
    images: rows(data, "images", ["url", "path", "alt", "credit"]).map((image) => ({
      url: image.url,
      ...(image.alt ? { alt: image.alt } : {}),
      ...(image.credit ? { credit: image.credit } : {}),
    })),
    items,
    leadPieceId: chosen >= 0 ? items[chosen].id : undefined,
    leadChosen: chosen >= 0,
    date: text(data, "date"),
    faqs: rows(data, "faqs", ["question", "answer"]).map((faq) => ({ question: faq.question ?? "", answer: faq.answer ?? "" })),
    links: readLinks(data),
  };
}
