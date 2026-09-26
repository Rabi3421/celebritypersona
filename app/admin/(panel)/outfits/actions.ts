"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getCelebrityViews, getOccasionViews, getAllOutfits } from "@/lib/db/content";
import { createOutfit, deleteOutfit, updateOutfit } from "@/lib/db/mutations";
import { csv, flag, indexedRows, lines, rows, text } from "@/lib/form-data";
import { canonicalName } from "@/lib/archive";
import { outfitSlug } from "@/lib/slugs";
import { isPublished, pieceLink, type OutfitItem } from "@/lib/types";
import { fieldErrors, outfitSchema, type FieldErrors } from "@/lib/validation";
import { blockingChecks, seoChecks } from "@/lib/seo-checks";
import { keywordOwners } from "@/lib/keyword-owners";

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

export type OutfitFormState = {
  attempt?: number;
  errors?: FieldErrors;
  values?: OutfitDraft;
  /**
   * Saved, but with something outstanding. A look that is already live saves
   * even when critical SEO checks fail — refusing it would block every
   * unrelated edit (a wrong price, a dead link) until the gap is closed — and
   * the failures come back here.
   */
  warnings?: string[];
  saved?: boolean;
};

const IMAGE_FIELDS = ["url", "path", "alt", "credit"];

/**
 * Every key a piece row posts. `rows()` reads only what is listed here, so a
 * field the form sends but this list omits is silently dropped on save — which
 * is how every save used to wipe a piece's retailer, affiliate link, network
 * and status, and hand it a new id that orphaned its click history.
 */
const ITEM_FIELDS = [
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
const PREFILLED = new Set(["id", "wornNetwork", "wornStatus", "swapNetwork", "swapStatus"]);

const hasTypedValue = (row: Record<string, string>) =>
  Object.entries(row).some(([key, value]) => !PREFILLED.has(key) && value !== "");

/**
 * What the form cannot carry, taken from the piece as it was stored.
 *
 * `checkedAt` is written by `npm run check:links`, not by a person, so it has
 * no input — and without this every save erased it. It is kept only while the
 * URL is the one that was checked.
 *
 * A changed URL goes the other way: the status that came back with the form was
 * a claim about the old URL, so unless the editor chose a new one it returns to
 * `unverified`. Nothing an editor typed a minute ago has been checked.
 */
function carryLinkHistory(items: OutfitItem[], previous: OutfitItem[] | undefined) {
  if (!previous) return items;
  const before = new Map(previous.filter((item) => item.id).map((item) => [item.id, item]));

  return items.map((item) => {
    const old = item.id ? before.get(item.id) : undefined;
    if (!old) return item;
    const next = { ...item };
    for (const side of ["original", "swap"] as const) {
      const key = side === "original" ? "wornLink" : "swapLink";
      const link = next[key];
      const was = pieceLink(old, side);
      if (!link || !was) continue;
      if (link.url === was.url) {
        next[key] = was.checkedAt ? { ...link, checkedAt: was.checkedAt } : link;
      } else if (link.status === was.status && link.status !== "sold_out") {
        next[key] = { ...link, status: "unverified" };
      }
    }
    return next;
  });
}

export async function saveOutfit(
  previous: OutfitFormState,
  form: FormData,
): Promise<OutfitFormState> {
  await requireAdmin();

  // Celebrity and occasion are typed by hand and become archive keys, so they
  // are settled against the names already in use before anything is stored —
  // otherwise a stray capital quietly forks a directory entry in two.
  // The merged views, so a record with no looks yet counts as a known name
  // just as much as a name only the outfits mention.
  const [occasions, celebrities, outfitsNow] = await Promise.all([
    getOccasionViews(),
    getCelebrityViews(),
    getAllOutfits(),
  ]);

  const draft: OutfitDraft = {
    celebrity: canonicalName(text(form, "celebrity"), celebrities.map((c) => c.name)),
    event: text(form, "event"),
    occasion: canonicalName(text(form, "occasion"), occasions.map((o) => o.name)),
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

  /**
   * The lead is a radio naming a row by the index it was posted under. Blank
   * rows are dropped before parsing, so the index is translated into a
   * position among the rows that survive, and from there into the piece's id
   * once the schema has made sure every piece has one.
   */
  const leadPosition = indexedRows(form, "items", ITEM_FIELDS)
    .filter((row) => hasTypedValue(row.values))
    .findIndex((row) => String(row.index) === draft.leadPiece);
  // Echoed on the row itself, so a rejected save reopens with the same lead.
  if (leadPosition >= 0) draft.items[leadPosition] = { ...draft.items[leadPosition], leadPiece: "on" };

  // The textarea is one paragraph per line; everything else posts as typed.
  const parsed = outfitSchema.safeParse({
    ...draft,
    notes: lines(form, "notes"),
    // Settled against known names, like the primary, so "diwali" does not
    // fork an occasion that already exists as "Diwali".
    occasions: csv(form, "occasions").map((name) => canonicalName(name, occasions.map((o) => o.name))),
    secondaryKeywords: csv(form, "secondaryKeywords"),
  });
  if (!parsed.success) return {
      attempt: (previous.attempt ?? 0) + 1,
      errors: fieldErrors(parsed.error),
      values: draft,
    };

  const id = Number(form.get("id"));

  // Two looks sharing a slug would share a URL and a photo folder, and one of
  // them would become unreachable.
  const taken = outfitsNow.some(
    (outfit) => outfit.id !== id && outfitSlug(outfit) === parsed.data.slug,
  );
  if (taken) {
    return {
      attempt: (previous.attempt ?? 0) + 1,
      errors: { slug: "Another look already uses this slug" },
      values: draft,
    };
  }

  const isUpdate = Number.isFinite(id) && id > 0;
  const stored = isUpdate ? outfitsNow.find((outfit) => outfit.id === id) : undefined;
  const fail = (errors: FieldErrors): OutfitFormState => ({
    attempt: (previous.attempt ?? 0) + 1,
    errors,
    values: draft,
  });

  /**
   * A published address is locked. Changing it needs the editor to press
   * Unlock, which is what posts `slugUnlocked`; the save then records a 301
   * from the old address, as every slug change on a live look does.
   */
  if (stored?.slugLockedAt && outfitSlug(stored) !== parsed.data.slug && !flag(form, "slugUnlocked")) {
    return fail({
      slug: `This slug has been public since ${stored.slugLockedAt}. Press Unlock to change it — the old address will 301 to the new one.`,
    });
  }

  const leadPieceId = leadPosition >= 0 ? parsed.data.items[leadPosition]?.id : undefined;
  const outfit = {
    ...parsed.data,
    ...(leadPieceId ? { leadPieceId } : {}),
    items: carryLinkHistory(parsed.data.items, stored?.items),
  };

  /**
   * The SEO checklist, run on exactly what is about to be stored, with the
   * same function the form runs live.
   *
   * It decides only the one moment that matters: a look going live. A draft
   * saves whatever the checks say. A look that is already live saves too, and
   * gets its failures back as warnings — every photograph and every price on
   * the site was published before this checklist existed, and none of them
   * should become uneditable because of it.
   */
  const blocking = blockingChecks(
    seoChecks({ ...outfit, leadChosen: Boolean(leadPieceId) }, { id, owners: keywordOwners(outfitsNow) }),
  );
  const alreadyLive = stored ? isPublished(stored) : false;
  const goingLive = outfit.status === "published" && !alreadyLive;

  if (goingLive && blocking.length > 0) {
    return fail({
      status: `Not published — ${blocking.length} critical ${blocking.length === 1 ? "check fails" : "checks fail"}. Fix ${blocking.length === 1 ? "it" : "them"}, or save as a draft.`,
      ...Object.fromEntries(
        blocking.map((check) => [`check.${check.id}`, `${check.label}${check.detail ? ` — ${check.detail}` : ""}`]),
      ),
    });
  }

  if (isUpdate) {
    await updateOutfit(id, outfit);
    // Held on the form rather than redirected away, so what is still missing
    // is read beside the fields it is about.
    if (outfit.status === "published" && blocking.length > 0) {
      return {
        attempt: (previous.attempt ?? 0) + 1,
        saved: true,
        warnings: blocking.map((check) => `${check.label}${check.detail ? ` — ${check.detail}` : ""}`),
        values: draft,
      };
    }
  } else {
    await createOutfit(outfit);
  }
  redirect("/admin/outfits");
}

export async function removeOutfit(form: FormData) {
  await requireAdmin();
  await deleteOutfit(Number(form.get("id")));

  // Deleting from a row should land back on the page and filters that were
  // open. Anything but a path on this list is ignored, so a posted field can
  // never send the admin somewhere else.
  const back = text(form, "returnTo");
  redirect(back.startsWith("/admin/outfits") ? back : "/admin/outfits");
}
