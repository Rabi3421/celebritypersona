"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  ErrorSummary,
  FormError,
  SaveButton,
  TextAreaField,
  TextField,
} from "@/components/admin/form/Fields";
import { RepeatableRows } from "@/components/admin/form/RepeatableRows";
import { OutfitImageEditor } from "@/components/admin/OutfitImageEditor";
import { removeOutfit, saveOutfit, type OutfitFormState } from "@/app/admin/(panel)/outfits/actions";
import { LINK_STATUSES, leadPiece, outfitOccasions, outfitPhotos, pieceLink, type Outfit, type OutfitItem } from "@/lib/types";
import { networkOptions } from "@/lib/affiliate/networks";
import { isNewLook, NEW_LOOK_DAYS, publishedDay } from "@/lib/archive";
import { outfitSlug } from "@/lib/slugs";
import { PIECE_CATEGORIES } from "@/lib/taxonomy";
import type { KeywordOwner } from "@/lib/seo-checks";
import { OutfitSeoProvider } from "@/components/admin/seo/OutfitSeoContext";
import { KeywordSection } from "@/components/admin/seo/KeywordSection";
import { SlugField } from "@/components/admin/seo/SlugField";
import { SeoTextField } from "@/components/admin/seo/SeoTextField";
import { SeoPanel } from "@/components/admin/seo/SeoPanel";
import { OccasionPicker } from "@/components/admin/seo/OccasionPicker";
import { ColoursInput } from "@/components/admin/seo/ColoursInput";
import styles from "@/app/admin/panel.module.css";
import { ConfirmButton } from "./ConfirmButton";
import { useRetryAfterSignIn } from "@/components/admin/session/AdminSession";
import { useFormAutosave } from "@/components/admin/session/useFormAutosave";
import { readOutfitDraft, type OutfitDraft } from "@/lib/outfit-form-fields";

/** How each status reads in the dropdown, in the order an editor meets them. */
const STATUS_LABELS: Record<(typeof LINK_STATUSES)[number], string> = {
  unverified: "Unverified — not checked yet",
  ok: "OK — checked, product is there",
  pending: "Pending — no link yet",
  sold_out: "Sold out",
  dead: "Dead — URL 404s",
};

const statusOptions = LINK_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

/**
 * The stored link records, spread back out into the flat keys the row inputs
 * post. `pieceLink` is used rather than the raw field, so a look that predates
 * the migration shows its legacy URL in the new boxes instead of an empty form.
 */
function flattenItem(item: OutfitItem, leadId: string | undefined) {
  const worn = pieceLink(item, "original");
  const swap = pieceLink(item, "swap");
  return {
    ...item,
    wornUrl: worn?.url ?? item.wornUrl,
    wornRetailer: worn?.retailer,
    wornAffiliateUrl: worn?.affiliateUrl,
    wornNetwork: worn?.network,
    wornStatus: worn?.status,
    swapUrl: swap?.url ?? item.swapUrl,
    swapRetailer: swap?.retailer,
    swapAffiliateUrl: swap?.affiliateUrl,
    swapNetwork: swap?.network,
    swapStatus: swap?.status,
    colours: item.colours?.join(","),
    leadPiece: leadId && item.id === leadId ? "on" : "",
  };
}

const categoryOptions = [
  { value: "", label: "Choose…" },
  ...PIECE_CATEGORIES.map((value) => ({ value, label: value })),
];

const FORM_ID = "outfit-form";

export function OutfitForm({
  outfit,
  occasions,
  takenSlugs = [],
  owners,
}: {
  outfit?: Outfit;
  occasions: string[];
  /** Slugs used by other looks, so a suggestion never collides with a live URL. */
  takenSlugs?: string[];
  /** Every look's primary keyword, for the cannibalisation check. */
  owners: KeywordOwner[];
}) {
  const [state, action] = useActionState<OutfitFormState, FormData>(saveOutfit, {});
  // A save that found the session gone asks for the password, then posts again.
  useRetryAfterSignIn(state, FORM_ID);
  const errors = state.errors;
  // The form is autosaved in this browser as it is edited, one draft per look.
  const draftKey = `cp:outfit-draft:${outfit?.id ?? "new"}`;
  const autosave = useFormAutosave(FORM_ID, draftKey);
  const [restored, setRestored] = useState<OutfitDraft | null>(null);
  /** Bumped on restore, to remount the fields with the restored values. */
  const [restoreCount, setRestoreCount] = useState(0);
  const draft = state.values ?? restored ?? undefined;

  // A save that stood (a live look with warnings) leaves nothing unsaved. A
  // save that redirected clears the draft from the list page instead.
  const { saved: markSaved } = autosave;
  useEffect(() => {
    if (state.saved) markSaved();
  }, [state, markSaved]);
  const status = draft?.status || (outfit ? (outfit.status ?? "published") : "draft");
  // The lead the page already uses is the one pre-selected, so an older look
  // opens with the radio on the piece its title is built from.
  const leadId = outfit ? (outfit.leadPieceId ?? leadPiece(outfit)?.id) : undefined;
  const pieces = draft?.items ?? outfit?.items.map((item) => flattenItem(item, leadId)) ?? [{ leadPiece: "on" }];

  return (
    <>
      <FormError message={errors?.form} />
      <ErrorSummary errors={errors} />

      {/* Saved, with something still outstanding. A look that is already live
          is never blocked on the checklist — that would freeze every unrelated
          edit — so the save stands and what is missing is listed here. */}
      {autosave.offer && !restored ? (
        <div className={styles.notice} role="status">
          <strong>Restore unsaved draft?</strong>
          <p>
            This browser kept a copy of this form from{" "}
            {new Date(autosave.offer.savedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{" "}
            that was never saved.
          </p>
          <div className={styles.formBar} style={{ marginTop: 10 }}>
            <button
              type="button"
              className={styles.saveButton}
              onClick={() => {
                const data = autosave.restore();
                if (!data) return;
                setRestored(readOutfitDraft(data));
                setRestoreCount((count) => count + 1);
              }}
            >
              Restore draft
            </button>
            <button type="button" className={styles.ghost} onClick={autosave.discard}>
              Discard it
            </button>
          </div>
        </div>
      ) : null}

      {state.saved && state.warnings?.length ? (
        <div className={styles.notice} role="status">
          <strong>Saved — this live look still fails {state.warnings.length} critical {state.warnings.length === 1 ? "check" : "checks"}</strong>
          <p>
            It stays published; nothing here blocks an edit to a look that is
            already live. A new look could not go live like this.
          </p>
          <ul className={styles.todo}>
            {state.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <OutfitSeoProvider
        formId={FORM_ID}
        owners={owners}
        outfitId={outfit?.id}
        takenSlugs={takenSlugs}
      >
        <div className={styles.editorLayout}>
          <form action={action} id={FORM_ID}>
            {outfit ? <input type="hidden" name="id" value={outfit.id} /> : null}
            {/* Named so a successful save can clear this browser's draft. */}
            <input type="hidden" name="draftKey" value={draftKey} />

            <div className={styles.formGrid} key={`fields-${restoreCount}`}>
              <KeywordSection
                primary={draft?.primaryKeyword ?? outfit?.primaryKeyword}
                secondary={
                  draft
                    ? draft.secondaryKeywords.split(",").map((value) => value.trim()).filter(Boolean)
                    : (outfit?.secondaryKeywords ?? [])
                }
                error={errors?.primaryKeyword}
              />

              <h3 className={styles.subhead}>The look</h3>

              <div className={styles.field}>
                <label htmlFor="status">Status</label>
                <select id="status" name="status" defaultValue={status}>
                  <option value="draft">Draft — not on the site</option>
                  <option value="published">Published</option>
                </select>
                <small>
                  Save as a draft whenever you like. Publishing needs every
                  critical check in the panel to pass; a look that is already
                  live keeps saving either way.
                </small>
                {errors?.status ? <p className={styles.bad}>{errors.status}</p> : null}
              </div>
              {/* The badge is counted from the day a look is first published,
                  so nobody has to remember to untick it three days later. */}
              <div className={styles.field}>
                <label>New badge</label>
                <small>
                  {outfit?.publishedAt || (outfit && outfit.status !== "draft")
                    ? `Added ${publishedDay(outfit)} — ${
                        isNewLook(outfit) ? "showing as New now" : "no longer showing as New"
                      }.`
                    : `Shows as New for its first ${NEW_LOOK_DAYS} days after it is published, then drops off on its own.`}
                </small>
              </div>

              <TextField
                name="celebrity"
                label="Celebrity"
                defaultValue={draft?.celebrity ?? outfit?.celebrity}
                placeholder="Full name, as she is credited"
                errors={errors}
                required
              />
              <TextField
                name="event"
                label="Event"
                defaultValue={draft?.event ?? outfit?.event}
                placeholder="Back to Black photoshoot"
                hint="Be specific: “Back to Black photoshoot”, “Mumbai airport”, “Thug Life trailer launch”. It appears in the breadcrumb, and “Instagram Photoshoot” describes half the archive."
                errors={errors}
                required
              />
              <TextField
                name="date"
                label="Date"
                type="date"
                defaultValue={draft?.date ?? outfit?.date}
                errors={errors}
                required
              />

              <OccasionPicker
                key={`occasions-${state.attempt ?? 0}`}
                options={occasions}
                primary={draft?.occasion ?? outfit?.occasion}
                selected={
                  draft
                    ? draft.occasions.split(",").map((value) => value.trim()).filter(Boolean)
                    : outfit
                      ? outfitOccasions(outfit)
                      : []
                }
                error={errors?.occasion}
              />

              <SlugField
                key={`slug-${state.attempt ?? 0}`}
                defaultValue={draft?.slug ?? (outfit ? outfitSlug(outfit) : undefined)}
                lockedSince={outfit?.slugLockedAt}
                error={errors?.slug}
              />

              {/* One credit for the whole set. The per-photo box inside the editor
                  is an override, for the rare look whose photographs come from
                  two places. */}
              <TextField
                name="photoCredit"
                label="Photo credit"
                hint="Where these photographs came from — an account, a photographer, an agency or a label. Covers every photo on the look; a photo from elsewhere can override it below."
                defaultValue={draft?.photoCredit ?? outfit?.photoCredit}
                placeholder="Instagram / @kayadulohar"
                errors={errors}
                wide
                required
              />

              <OutfitImageEditor
                key={`photo-${state.attempt ?? 0}`}
                initialImages={draft?.images ?? (outfit ? outfitPhotos(outfit) : [])}
                initialItems={outfit?.items ?? []}
              />

              <TextAreaField
                name="notes"
                label="About this look"
                rows={8}
                hint="One paragraph per line, 150 words or more, with the primary keyword in the first paragraph. Your own words on the styling, the fabric, the occasions it suits — this is what a search engine cannot get from the brand's product page. Prices in ₹."
                defaultValue={draft?.notes ?? outfit?.notes?.join("\n")}
                placeholder={"Rukmini Vasanth's black dress for the Back to Black shoot is Club L London's bardot buckle midi — an off-shoulder corset cut with sheer mesh sleeves.\nIt works well past a photoshoot: a cocktail party, a date night, New Year's Eve."}
                errors={errors}
              />

              <h3 className={styles.subhead}>Search appearance</h3>

              <SeoTextField
                key={`seoTitle-${state.attempt ?? 0}`}
                name="seoTitle"
                defaultValue={draft?.seoTitle ?? outfit?.seoTitle}
                hint="The blue link, and the page's H1. Generate builds “{Celebrity}'s {Colour} {Garment} by {Brand}” from the lead piece, keeping every word of the primary keyword. Empty falls back to a title built from the lead piece — the panel shows which."
                error={errors?.seoTitle}
              />
              <SeoTextField
                key={`seoDescription-${state.attempt ?? 0}`}
                name="seoDescription"
                defaultValue={draft?.seoDescription ?? outfit?.seoDescription}
                hint="The grey text under the link. Generate opens with the primary keyword and closes on the swap price in ₹. Empty falls back to your first paragraph, or a line built from the pieces."
                error={errors?.seoDescription}
              />

              <RepeatableRows
                key={`items-${state.attempt ?? 0}`}
                name="items"
                title="Pieces"
                hint="Only the piece name is required to save. Pick the lead piece — the one the look is about — and give every piece a category before publishing."
                columns="minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)"
                error={errors?.items}
                initial={pieces}
                addLabel="Add a piece"
                fields={[
                  // Posted back unchanged, so a save keeps the id every outbound
                  // click on this piece is recorded against. Empty on a new row;
                  // the schema assigns one.
                  { key: "id", label: "Piece id", type: "hidden" },
                  { key: "leadPiece", label: "Lead piece", type: "radio", placeholder: "The look is about this" },
                  { key: "name", label: "Piece", placeholder: "Colour, fabric, garment" },
                  { key: "category", label: "Category", options: categoryOptions },
                  {
                    key: "colours",
                    label: "Colours",
                    render: ({ id, name, value }) => <ColoursInput id={id} name={name} defaultValue={value} />,
                  },
                  {
                    key: "note",
                    label: "Note (optional)",
                    placeholder: "Chikankari on cotton mul, elbow sleeves",
                  },
                  { key: "wornBrand", label: "Worn brand (optional)", placeholder: "The label she wore" },
                  { key: "worn", label: "Worn ₹ (optional)", type: "number" },
                  {
                    key: "wornUrl",
                    label: "Worn link (optional)",
                    type: "url",
                    placeholder: "https://…",
                  },
                  {
                    key: "soldOut",
                    label: "Stock",
                    type: "checkbox",
                    placeholder: "Sold out",
                  },
                  { key: "wornRetailer", label: "Worn retailer", placeholder: "Named from the link" },
                  {
                    key: "wornAffiliateUrl",
                    label: "Worn affiliate link",
                    type: "url",
                    placeholder: "Paste once approved",
                  },
                  { key: "wornNetwork", label: "Worn network", options: networkOptions },
                  { key: "wornStatus", label: "Worn link status", options: statusOptions },
                  { key: "swapBrand", label: "Swap brand (optional)", placeholder: "The retailer you found" },
                  { key: "swap", label: "Swap ₹ (optional)", type: "number" },
                  {
                    key: "swapUrl",
                    label: "Swap link (optional)",
                    type: "url",
                    placeholder: "https://…",
                  },
                  { key: "swapRetailer", label: "Swap retailer", placeholder: "Named from the link" },
                  {
                    key: "swapAffiliateUrl",
                    label: "Swap affiliate link",
                    type: "url",
                    placeholder: "Paste once approved",
                  },
                  { key: "swapNetwork", label: "Swap network", options: networkOptions },
                  { key: "swapStatus", label: "Swap link status", options: statusOptions },
                ]}
              />

              <RepeatableRows
                key={`faqs-${state.attempt ?? 0}`}
                name="faqs"
                title="Questions (optional)"
                hint="Questions a reader actually asks about this look, answered on the page. Leave the row empty for none."
                columns="minmax(0,1fr) minmax(0,2fr)"
                initial={draft?.faqs ?? outfit?.faqs ?? []}
                addLabel="Add a question"
                fields={[
                  { key: "question", label: "Question", placeholder: "Where can I buy Rukmini Vasanth's black dress?" },
                  { key: "answer", label: "Answer", placeholder: "It is Club L London's …" },
                ]}
              />
            </div>

            <div className={styles.formBar}>
              <SaveButton>{outfit ? "Save changes" : "Create outfit"}</SaveButton>
              {outfit ? (
                <Link className={styles.ghost} href={`/admin/preview/${outfit.id}`} target="_blank">
                  Preview ↗
                </Link>
              ) : null}
              <Link className={styles.ghost} href="/admin/outfits">
                Cancel
              </Link>
            </div>
          </form>

          <SeoPanel />
        </div>
      </OutfitSeoProvider>

      {outfit ? (
        <form action={removeOutfit} className={styles.formBar}>
          <input type="hidden" name="id" value={outfit.id} />
          <ConfirmButton
            className={styles.danger}
            title="Delete this look?"
            message="The look comes off the site, along with its photos. This cannot be undone."
          >
            Delete this outfit
          </ConfirmButton>
        </form>
      ) : null}
    </>
  );
}
