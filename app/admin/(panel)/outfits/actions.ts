"use server";

import { redirect } from "next/navigation";
import { adminForAction, requireAdmin, SESSION_EXPIRED_MESSAGE } from "@/lib/auth/admin";
import { getCelebrityViews, getOccasionViews, getAllOutfits } from "@/lib/db/content";
import { createOutfit, deleteOutfit, setOutfitStatus, updateOutfit } from "@/lib/db/mutations";
import { csv, flag, lines, text } from "@/lib/form-data";
import { leadPosition, readOutfitDraft, type OutfitDraft } from "@/lib/outfit-form-fields";
import { canonicalName } from "@/lib/archive";
import { outfitSlug } from "@/lib/slugs";
import { isPublished, outfitPhotos, pieceLink, type OutfitItem } from "@/lib/types";
import { fieldErrors, outfitSchema, type FieldErrors } from "@/lib/validation";
import { blockingChecks, seoChecks } from "@/lib/seo-checks";
import { keywordOwners } from "@/lib/keyword-owners";
import { lookJobForOutfit } from "@/lib/db/look-jobs";
import { reviewProblem } from "@/lib/look-jobs";

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
  /** The session ran out before the save; the form asks for the password in
   *  place and posts again. Nothing was written. */
  sessionExpired?: boolean;
};

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
  const admin = await adminForAction();

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

  // Celebrity and occasion become archive keys, so they are settled against
  // the names already in use.
  const draft = readOutfitDraft(form);
  draft.celebrity = canonicalName(draft.celebrity, celebrities.map((c) => c.name));
  draft.occasion = canonicalName(draft.occasion, occasions.map((o) => o.name));

  if (!admin) {
    return {
      attempt: (previous.attempt ?? 0) + 1,
      sessionExpired: true,
      errors: { form: SESSION_EXPIRED_MESSAGE },
      values: draft,
    };
  }

  const leadIndex = leadPosition(form);

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

  const leadPieceId = leadIndex >= 0 ? parsed.data.items[leadIndex]?.id : undefined;
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

  // A look made from research also needs every research check confirmed.
  if (goingLive && isUpdate) {
    const problem = reviewProblem(await lookJobForOutfit(id));
    if (problem) return fail({ status: `Not published — ${problem} (/admin/preview/${id}). Or save as a draft.` });
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
  // The list page clears this browser's autosaved copy of the form. Only a key
  // of the shape the form writes is passed on.
  const draftKey = text(form, "draftKey");
  redirect(
    /^cp:outfit-draft:(new|\d+)$/.test(draftKey)
      ? `/admin/outfits?draftSaved=${encodeURIComponent(draftKey)}`
      : "/admin/outfits",
  );
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

/**
 * Publish or unpublish a look from the list, without opening the editor.
 *
 * Publishing runs the same critical SEO checks as the editor's save; when any
 * fails nothing changes and the list names what to fix. Unpublishing returns
 * the look to draft (its address keeps its 301 history, as on any edit).
 */
export async function changeOutfitStatus(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("id"));
  const status = text(form, "status") === "published" ? "published" : "draft";
  const raw = text(form, "returnTo");
  const back = new URL(raw.startsWith("/admin/outfits") ? raw : "/admin/outfits", "http://admin.local");
  back.searchParams.delete("statusProblem");

  if (status === "published") {
    const outfits = await getAllOutfits();
    const stored = outfits.find((outfit) => outfit.id === id);
    if (!stored) redirect(back.pathname + back.search);
    const blocking = blockingChecks(
      seoChecks(
        { ...stored, slug: outfitSlug(stored), images: outfitPhotos(stored), leadChosen: Boolean(stored.leadPieceId) },
        { id, owners: keywordOwners(outfits) },
      ),
    );
    const problem = reviewProblem(await lookJobForOutfit(id));
    if (problem) {
      back.searchParams.set("statusProblem", `${id}|${problem}`);
      // Back to the row it is about, where the reason is shown.
      redirect(`${back.pathname}${back.search}#outfit-${id}`);
    }
    if (blocking.length) {
      const reasons = blocking.map((check) => `${check.label}${check.detail ? ` — ${check.detail}` : ""}`).join(" · ");
      back.searchParams.set("statusProblem", `${id}|${reasons}`.slice(0, 600));
      redirect(`${back.pathname}${back.search}#outfit-${id}`);
    }
  }
  await setOutfitStatus(id, status);
  redirect(back.pathname + back.search);
}
