"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  CheckField,
  ErrorSummary,
  FormError,
  SaveButton,
  SelectField,
  TextField,
} from "@/components/admin/form/Fields";
import { RepeatableRows } from "@/components/admin/form/RepeatableRows";
import { removeOutfit, saveOutfit, type OutfitFormState } from "@/app/admin/(panel)/outfits/actions";
import type { Outfit } from "@/lib/types";
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
          <CheckField name="isNew" label="Flag as new" defaultChecked={draft?.isNew ?? outfit?.isNew} />

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
              { key: "wornBrand", label: "Worn brand", placeholder: "Anita Dongre" },
              { key: "worn", label: "Worn ₹", type: "number" },
              {
                key: "wornUrl",
                label: "Worn link (optional)",
                type: "url",
                placeholder: "https://…",
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
        <form action={removeOutfit} className={styles.formBar}>
          <input type="hidden" name="id" value={outfit.id} />
          <button className={styles.danger} type="submit">
            Delete this outfit
          </button>
        </form>
      ) : null}
    </>
  );
}
