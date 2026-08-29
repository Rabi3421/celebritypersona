"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  ErrorSummary,
  FormError,
  NumberField,
  SaveButton,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/admin/form/Fields";
import { RepeatableRows } from "@/components/admin/form/RepeatableRows";
import {
  removeOccasion,
  saveOccasion,
  type OccasionFormState,
} from "@/app/admin/(panel)/occasions/actions";
import type { Occasion } from "@/lib/types";
import styles from "@/app/admin/panel.module.css";

const GROUPS = ["Wedding", "Festival", "Everyday"] as const;

export function OccasionForm({ occasion }: { occasion?: Occasion }) {
  const [state, action] = useActionState<OccasionFormState, FormData>(saveOccasion, {});
  const errors = state.errors;
  const draft = state.values;

  return (
    <>
      <FormError message={errors?.form} />
      <ErrorSummary errors={errors} />
      <form action={action} id="entity-form">
        {occasion ? <input type="hidden" name="id" value={occasion.id} /> : null}
        <div className={styles.formGrid}>
          <TextField name="name" label="Name" defaultValue={draft?.name ?? occasion?.name} errors={errors} required />
          <SelectField name="group" label="Group" options={GROUPS} defaultValue={draft?.group ?? occasion?.group} errors={errors} />
          <NumberField name="looks" label="Published looks" defaultValue={draft?.looks ?? occasion?.looks ?? 0} errors={errors} />
          <NumberField name="swapFrom" label="Swaps from ₹" defaultValue={draft?.swapFrom ?? occasion?.swapFrom ?? 0} errors={errors} />
          <NumberField name="averageWorn" label="Average worn ₹" defaultValue={draft?.averageWorn ?? occasion?.averageWorn ?? 0} errors={errors} />
          <NumberField name="averageSwap" label="Average swap ₹" defaultValue={draft?.averageSwap ?? occasion?.averageSwap ?? 0} errors={errors} />
          <TextField name="peak" label="Peak" defaultValue={draft?.peak ?? occasion?.peak} placeholder="Peaks Nov–Feb" errors={errors} />
          <TextAreaField name="description" label="Description" defaultValue={draft?.description ?? occasion?.description} errors={errors} rows={3} />

          <RepeatableRows
            key={`colours-${state.attempt ?? 0}`}
            name="colours"
            title="Palette"
            hint="Shown as swatches"
            columns="minmax(0,1fr) 160px"
            error={errors?.colours}
            initial={draft?.colours ?? occasion?.colours ?? []}
            addLabel="Add a colour"
            fields={[
              { key: "name", label: "Colour", placeholder: "Emerald" },
              { key: "value", label: "Hex", placeholder: "#0E5E45" },
            ]}
          />
          <RepeatableRows
            key={`garments-${state.attempt ?? 0}`}
            name="garments"
            title="Garments"
            hint="Counts shown on the occasion page"
            columns="minmax(0,1fr) 160px"
            error={errors?.garments}
            initial={draft?.garments ?? occasion?.garments ?? []}
            addLabel="Add a garment"
            fields={[
              { key: "name", label: "Garment", placeholder: "Lehenga" },
              { key: "count", label: "Count", type: "number" },
            ]}
          />
        </div>
        <div className={styles.formBar}>
          <SaveButton>{occasion ? "Save changes" : "Create occasion"}</SaveButton>
          <Link className={styles.ghost} href="/admin/occasions">Cancel</Link>
        </div>
      </form>
      {occasion ? (
        <form action={removeOccasion} className={styles.formBar}>
          <input type="hidden" name="id" value={occasion.id} />
          <button className={styles.danger} type="submit">Delete this occasion</button>
        </form>
      ) : null}
    </>
  );
}
