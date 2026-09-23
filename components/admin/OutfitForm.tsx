"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  ErrorSummary,
  FormError,
  SaveButton,
  ComboField,
  TextAreaField,
  TextField,
} from "@/components/admin/form/Fields";
import { RepeatableRows } from "@/components/admin/form/RepeatableRows";
import { OutfitImageEditor } from "@/components/admin/OutfitImageEditor";
import { removeOutfit, saveOutfit, type OutfitFormState } from "@/app/admin/(panel)/outfits/actions";
import { LINK_STATUSES, outfitPhotos, pieceLink, type Outfit, type OutfitItem } from "@/lib/types";
import { networkOptions } from "@/lib/affiliate/networks";
import { isNewLook, NEW_LOOK_DAYS, publishedDay } from "@/lib/archive";
import { outfitSlug } from "@/lib/slugs";
import styles from "@/app/admin/panel.module.css";
import { ConfirmButton } from "./ConfirmButton";

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
function flattenItem(item: OutfitItem) {
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
  };
}

export function OutfitForm({
  outfit,
  occasions,
}: {
  outfit?: Outfit;
  occasions: string[];
}) {
  const [state, action] = useActionState<OutfitFormState, FormData>(saveOutfit, {});
  const errors = state.errors;
  const draft = state.values;

  return (
    <>
      <FormError message={errors?.form} />
      <ErrorSummary errors={errors} />

      {/* Saved, with something still outstanding. An update is never blocked
          on a missing photo credit — that would make one unrelated gap freeze
          the whole record — so the save stands and the gap is stated here,
          beside the photographs it is about. */}
      {state.saved && state.warnings?.length ? (
        <div className={styles.notice} role="status">
          <strong>Saved — but this look cannot be published as it stands</strong>
          <p>
            Every photograph here was taken by somebody else, and these name no
            source. A new look cannot be created with them; this one is already
            live, so the change was kept.
          </p>
          <ul className={styles.todo}>
            {state.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form action={action} id="outfit-form">
        {outfit ? <input type="hidden" name="id" value={outfit.id} /> : null}

        <div className={styles.formGrid}>
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
            placeholder="Mumbai Airport"
            errors={errors}
            required
          />
          <ComboField
            name="occasion"
            label="Occasion"
            options={occasions}
            defaultValue={draft?.occasion ?? outfit?.occasion}
            placeholder="Airport"
            hint="Pick one, or type a new one — it appears under Occasions straight away, ready for its guide copy."
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
          <TextField
            name="slug"
            label="Slug"
            hint="The look's URL segment, and the folder its photos are uploaded into"
            defaultValue={draft?.slug ?? (outfit ? outfitSlug(outfit) : undefined)}
            placeholder="amyra-dastur-savanna-co-ord"
            errors={errors}
            required
          />
          {/* The badge is no longer a checkbox. It is counted from the day a
              look is added, so nobody has to remember to come back and untick
              it three days later. */}
          <div className={styles.field}>
            <label>New badge</label>
            <small>
              {outfit
                ? `Added ${publishedDay(outfit)} — ${
                    isNewLook(outfit)
                      ? "showing as New now"
                      : "no longer showing as New"
                  }.`
                : `Shows as New for its first ${NEW_LOOK_DAYS} days, then drops off on its own.`}
            </small>
          </div>

          <OutfitImageEditor
            key={`photo-${state.attempt ?? 0}`}
            initialImages={draft?.images ?? (outfit ? outfitPhotos(outfit) : [])}
            initialItems={outfit?.items ?? []}
          />

          <TextAreaField
            name="notes"
            label="About this look"
            rows={6}
            hint="One paragraph per line. Your own words on the styling, the fabric, the occasion — this is what a search engine cannot get from the brand's product page, and without it the look stays out of Google."
            defaultValue={draft?.notes ?? outfit?.notes?.join("\n")}
            placeholder={"Amyra wore the Savanna Gypsy co-ord for Label Monik's campaign — a hand-blocked cotton set cut as a bralette and a draped sarong skirt.\nThe print is Kalamkari-inspired, which is why it reads as festive even though the fabric is everyday cotton."}
            errors={errors}
          />

          <h3 className={styles.subhead}>Search appearance</h3>

          <TextField
            name="seoTitle"
            label="Search title (optional)"
            hint="Up to 60 characters — what Google shows as the blue link. Leave it empty and the page builds one from the lead piece and its label, e.g. “Ritika Nayak's Pink Floral Draped Jumpsuit — Ewoke Studio”."
            defaultValue={draft?.seoTitle ?? outfit?.seoTitle}
            placeholder="Ritika Nayak's Pink Floral Draped Jumpsuit — Ewoke Studio"
            errors={errors}
          />
          <TextAreaField
            name="seoDescription"
            label="Search description (optional)"
            rows={3}
            hint="Up to 160 characters — the grey text under the link. Empty falls back to your first paragraph, or to a line built from the pieces and prices."
            defaultValue={draft?.seoDescription ?? outfit?.seoDescription}
            placeholder="Every piece Ritika Nayak wore, identified and priced — the Ewoke Studio jumpsuit at ₹9,891, with where to buy it."
            errors={errors}
          />

          <RepeatableRows
            key={`items-${state.attempt ?? 0}`}
            name="items"
            title="Pieces"
            hint="Only the piece name is required — totals are calculated from what you fill in"
            columns="minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)"
            error={errors?.items}
            initial={draft?.items ?? outfit?.items.map(flattenItem) ?? []}
            addLabel="Add a piece"
            fields={[
              { key: "name", label: "Piece", placeholder: "Colour, fabric, garment" },
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
        </div>

        <div className={styles.formBar}>
          <SaveButton>{outfit ? "Save changes" : "Create outfit"}</SaveButton>
          <Link className={styles.ghost} href="/admin/outfits">
            Cancel
          </Link>
        </div>
      </form>

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
