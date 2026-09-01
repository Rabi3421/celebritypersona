"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  ErrorSummary,
  FormError,
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
import type { OccasionView } from "@/lib/archive";
import styles from "@/app/admin/panel.module.css";

const GROUPS = ["Wedding", "Festival", "Everyday"] as const;
const money = (value: number | null) =>
  value === null ? "—" : `₹${value.toLocaleString("en-IN")}`;

/** Look counts, price averages, the cheapest complete look and the garment
 *  tally are all counted from the outfits filed under this occasion. */
export function OccasionForm({ occasion }: { occasion?: OccasionView }) {
  const [state, action] = useActionState<OccasionFormState, FormData>(saveOccasion, {});
  const errors = state.errors;
  const draft = state.values;
  const stats = occasion?.stats;

  return (
    <>
      <FormError message={errors?.form} />
      <ErrorSummary errors={errors} />

      {stats ? (
        <section className={styles.section} style={{ marginTop: 0 }}>
          <div className={styles.sectionHead}>
            <h2>Counted from its looks</h2>
            <span>Not editable — publish a look and these move</span>
          </div>
          <div className={styles.tiles}>
            <div className={styles.tile}>
              <span>Looks decoded</span>
              <b>{stats.looks}</b>
              <small>{stats.pieces} pieces identified</small>
            </div>
            <div className={styles.tile}>
              <span>Cheapest complete look</span>
              <b className={styles.ok}>{money(stats.swapFrom)}</b>
              <small>Every piece swapped</small>
            </div>
            <div className={styles.tile}>
              <span>Averages</span>
              <b>{money(stats.averageWorn)}</b>
              <small>Swaps average {money(stats.averageSwap)}</small>
            </div>
            <div className={styles.tile}>
              <span>Garments</span>
              <b>{stats.garments.length}</b>
              <small>
                {stats.garments.slice(0, 3).map((garment) => garment.name).join(" · ") || "None yet"}
              </small>
            </div>
          </div>
        </section>
      ) : null}

      <form action={action} id="entity-form">
        {occasion ? <input type="hidden" name="id" value={occasion.id} /> : null}
        <div className={styles.formGrid}>
          <TextField name="name" label="Name" hint="Must match the occasion on its outfits exactly"
            defaultValue={draft?.name ?? occasion?.name} errors={errors} required />
          <SelectField name="group" label="Group" options={GROUPS} defaultValue={draft?.group ?? occasion?.group} errors={errors} />
          <TextField name="peak" label="Peak" defaultValue={draft?.peak ?? occasion?.peak} placeholder="Peaks Nov–Feb" errors={errors} />
          <TextField name="nextDate" label="Next date" type="date"
            hint="Drives the “Coming up” countdown. Leave empty for occasions with no fixed date."
            defaultValue={draft?.nextDate ?? occasion?.nextDate ?? ""} errors={errors} />
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
        </div>
        <div className={styles.formBar}>
          <SaveButton>{occasion ? "Save changes" : "Create occasion"}</SaveButton>
          <Link className={styles.ghost} href="/admin/occasions">Cancel</Link>
        </div>
      </form>
      {occasion ? (
        <form
          action={removeOccasion}
          className={styles.formBar}
          onSubmit={(event) => {
            if (!window.confirm("Delete this occasion? Its looks stay, but the guide copy and palette are gone for good.")) event.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={occasion.id} />
          <button className={styles.danger} type="submit">Delete this occasion</button>
        </form>
      ) : null}
    </>
  );
}
