"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  CheckField,
  ErrorSummary,
  FormError,
  SaveButton,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/admin/form/Fields";
import { RepeatableRows } from "@/components/admin/form/RepeatableRows";
import { OutfitImageEditor } from "@/components/admin/OutfitImageEditor";
import { removeOutfit, saveOutfit, type OutfitFormState } from "@/app/admin/(panel)/outfits/actions";
import { outfitPhotos, type Outfit } from "@/lib/types";
import { outfitSlug } from "@/lib/slugs";
import styles from "@/app/admin/panel.module.css";

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

      <form action={action} id="outfit-form">
        {outfit ? <input type="hidden" name="id" value={outfit.id} /> : null}

        <div className={styles.formGrid}>
          <TextField
            name="celebrity"
            label="Celebrity"
            defaultValue={draft?.celebrity ?? outfit?.celebrity}
            placeholder="Alia Bhatt"
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
          <SelectField
            name="occasion"
            label="Occasion"
            options={occasions}
            defaultValue={draft?.occasion ?? outfit?.occasion}
            errors={errors}
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
          <CheckField name="isNew" label="Flag as new" defaultChecked={draft?.isNew ?? outfit?.isNew} />

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
            hint="Totals are calculated from these"
            columns="minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)"
            error={errors?.items}
            initial={draft?.items ?? outfit?.items ?? []}
            addLabel="Add a piece"
            fields={[
              { key: "name", label: "Piece", placeholder: "Ivory kurta" },
              {
                key: "note",
                label: "Note (optional)",
                placeholder: "Chikankari on cotton mul, elbow sleeves",
              },
              { key: "wornBrand", label: "Worn brand", placeholder: "Anita Dongre" },
              { key: "worn", label: "Worn ₹", type: "number" },
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
              { key: "swapBrand", label: "Swap brand (optional)", placeholder: "Libas" },
              { key: "swap", label: "Swap ₹ (optional)", type: "number" },
              {
                key: "swapUrl",
                label: "Swap link (optional)",
                type: "url",
                placeholder: "https://…",
              },
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
        <form
          action={removeOutfit}
          className={styles.formBar}
          onSubmit={(event) => {
            if (!window.confirm("Delete this look? Its photos are removed too, and this cannot be undone.")) event.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={outfit.id} />
          <button className={styles.danger} type="submit">
            Delete this outfit
          </button>
        </form>
      ) : null}
    </>
  );
}
