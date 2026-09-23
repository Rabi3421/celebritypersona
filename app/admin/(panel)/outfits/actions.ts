"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getCelebrityViews, getOccasionViews, getAllOutfits } from "@/lib/db/content";
import { createOutfit, deleteOutfit, updateOutfit } from "@/lib/db/mutations";
import { lines, rows, text } from "@/lib/form-data";
import { canonicalName } from "@/lib/archive";
import { outfitSlug } from "@/lib/slugs";
import { fieldErrors, outfitSchema, type FieldErrors } from "@/lib/validation";
import { CREDIT_REQUIRED_MESSAGE, creditProblems } from "@/lib/photo-credit";

/** Exactly what the form posted, echoed back so a rejected save keeps the
 *  typing. React resets an uncontrolled form after every action. */
export type OutfitDraft = {
  celebrity: string;
  event: string;
  occasion: string;
  date: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  images: { url: string; path: string; alt?: string; credit?: string }[];
  notes: string;
  items: Record<string, string>[];
};

export type OutfitFormState = {
  attempt?: number;
  errors?: FieldErrors;
  values?: OutfitDraft;
  /**
   * Saved, but with something outstanding. An update that only needs a photo
   * credit is still a save worth keeping: refusing it blocks every unrelated
   * edit on the look until an editor tracks down a credit for a photograph
   * somebody uploaded months ago.
   */
  warnings?: string[];
  saved?: boolean;
};

const IMAGE_FIELDS = ["url", "path", "alt", "credit"];

const ITEM_FIELDS = [
  "name",
  "wornBrand",
  "worn",
  "wornUrl",
  "swapBrand",
  "swap",
  "swapUrl",
  "note",
  "soldOut",
  "hotspotX",
  "hotspotY",
];

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
    date: text(form, "date"),
    slug: text(form, "slug"),
    seoTitle: text(form, "seoTitle"),
    seoDescription: text(form, "seoDescription"),
    images: rows(form, "images", IMAGE_FIELDS) as OutfitDraft["images"],
    notes: text(form, "notes"),
    items: rows(form, "items", ITEM_FIELDS),
  };

  // The textarea is one paragraph per line; everything else posts as typed.
  const parsed = outfitSchema.safeParse({ ...draft, notes: lines(form, "notes") });
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

  /**
   * Every photograph here was taken by somebody else, so publishing one
   * uncredited is not ours to do — but the rule has to bite where publishing
   * happens, not on every save.
   *
   * Creating a look is the act of publishing it, so it is blocked outright: no
   * photographs at all, or any photograph that names no source, and the look
   * is not created. Updating one that is already live cannot be blocked, or a
   * single missing credit makes the whole record read-only and an editor
   * cannot fix a wrong price without first solving an unrelated problem. Those
   * save, and say what is still outstanding.
   */
  const problems = creditProblems(parsed.data.images);

  if (!isUpdate) {
    if (parsed.data.images.length === 0) {
      return {
        attempt: (previous.attempt ?? 0) + 1,
        errors: { images: "Add at least one photo before publishing this look." },
        values: draft,
      };
    }
    if (problems.length > 0) {
      return {
        attempt: (previous.attempt ?? 0) + 1,
        errors: { images: `${CREDIT_REQUIRED_MESSAGE} ${problems.join(" ")}` },
        values: draft,
      };
    }
  }

  if (isUpdate) {
    await updateOutfit(id, parsed.data);
    // Held on the form rather than redirected away, so the warning is read
    // beside the photographs it is about.
    if (problems.length > 0) {
      return { attempt: (previous.attempt ?? 0) + 1, saved: true, warnings: problems, values: draft };
    }
  } else {
    await createOutfit(parsed.data);
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
