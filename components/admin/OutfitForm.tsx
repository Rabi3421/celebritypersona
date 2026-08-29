"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  CheckField,
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

  return (
    <>
      <FormError message={errors?.form} />

      <form action={action} id="outfit-form">
        {outfit ? <input type="hidden" name="id" value={outfit.id} /> : null}

        <div className={styles.formGrid}>
          <TextField
            name="celebrity"
            label="Celebrity"
            defaultValue={outfit?.celebrity}
            placeholder="Alia Bhatt"
            errors={errors}
            required
          />
          <TextField
            name="event"
            label="Event"
            defaultValue={outfit?.event}
            placeholder="Mumbai Airport"
            errors={errors}
            required
          />
          <SelectField
            name="occasion"
            label="Occasion"
            options={occasions}
            defaultValue={outfit?.occasion}
            errors={errors}
          />
          <TextField
            name="date"
            label="Date"
            type="date"
            defaultValue={outfit?.date}
            errors={errors}
            required
          />
          <CheckField name="isNew" label="Flag as new" defaultChecked={outfit?.isNew} />

          <RepeatableRows
            name="items"
            title="Pieces"
            hint="Totals are calculated from these"
            columns="minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr) 130px 130px"
            error={errors?.items}
            initial={outfit?.items ?? []}
            addLabel="Add a piece"
            fields={[
              { key: "name", label: "Piece", placeholder: "Ivory kurta" },
              { key: "wornBrand", label: "Worn brand", placeholder: "Anita Dongre" },
              { key: "swapBrand", label: "Swap brand", placeholder: "Libas" },
              { key: "worn", label: "Worn ₹", type: "number" },
              { key: "swap", label: "Swap ₹", type: "number" },
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
