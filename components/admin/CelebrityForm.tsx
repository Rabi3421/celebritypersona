"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  ErrorSummary,
  FormError,
  SaveButton,
  TextAreaField,
  TextField,
} from "@/components/admin/form/Fields";
import {
  removeCelebrity,
  saveCelebrity,
  type CelebrityFormState,
} from "@/app/admin/(panel)/celebrities/actions";
import type { CelebrityView } from "@/lib/archive";
import styles from "@/app/admin/panel.module.css";

/** Her look count, average saving, price range and repeated labels are counted
 *  from the outfits, so the form only asks for what a person writes. */
export function CelebrityForm({ celebrity }: { celebrity?: CelebrityView }) {
  const [state, action] = useActionState<CelebrityFormState, FormData>(
    saveCelebrity,
    {},
  );
  const errors = state.errors;
  const draft = state.values;
  const stats = celebrity?.stats;

  return (
    <>
      <FormError message={errors?.form} />
      <ErrorSummary errors={errors} />

      {stats ? (
        <section className={styles.section} style={{ marginTop: 0 }}>
          <div className={styles.sectionHead}>
            <h2>Counted from her looks</h2>
            <span>Not editable — publish a look and these move</span>
          </div>
          <div className={styles.tiles}>
            <div className={styles.tile}>
              <span>Looks decoded</span>
              <b>{stats.looks}</b>
              <small>{stats.pieces} pieces identified</small>
            </div>
            <div className={styles.tile}>
              <span>Average saving</span>
              <b className={styles.ok}>
                {stats.averageSaving === null ? "—" : `${stats.averageSaving}%`}
              </b>
              <small>Across looks priced on both sides</small>
            </div>
            <div className={styles.tile}>
              <span>Typical range</span>
              <b>
                {stats.low === null || stats.high === null
                  ? "—"
                  : `₹${stats.low.toLocaleString("en-IN")}–₹${stats.high.toLocaleString("en-IN")}`}
              </b>
              <small>Cheapest to priciest, as worn</small>
            </div>
            <div className={styles.tile}>
              <span>Repeated labels</span>
              <b>{stats.brands.length}</b>
              <small>
                {stats.brands.slice(0, 3).map((brand) => brand.name).join(" · ") || "None yet"}
              </small>
            </div>
          </div>
        </section>
      ) : null}

      <form action={action} id="entity-form">
        {celebrity ? <input type="hidden" name="id" value={celebrity.id} /> : null}
        <div className={styles.formGrid}>
          <TextField name="name" label="Name" hint="Must match the celebrity on her outfits exactly"
            defaultValue={draft?.name ?? celebrity?.name} errors={errors} required wide />
          <TextAreaField
            name="bio"
            label="Bio"
            hint="One paragraph per line. Leave empty to generate one from her archive."
            defaultValue={draft?.bio ?? celebrity?.bio?.join("\n")}
            errors={errors}
            rows={6}
          />
        </div>
        <div className={styles.formBar}>
          <SaveButton>{celebrity ? "Save changes" : "Create celebrity"}</SaveButton>
          <Link className={styles.ghost} href="/admin/celebrities">Cancel</Link>
        </div>
      </form>
      {celebrity ? (
        <form
          action={removeCelebrity}
          className={styles.formBar}
          onSubmit={(event) => {
            if (!window.confirm("Delete this archive? Her looks stay, but the bio and record are gone for good.")) event.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={celebrity.id} />
          <button className={styles.danger} type="submit">Delete this celebrity</button>
        </form>
      ) : null}
    </>
  );
}
