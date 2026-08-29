"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  CheckField,
  ErrorSummary,
  FormError,
  NumberField,
  SaveButton,
  TextAreaField,
  TextField,
} from "@/components/admin/form/Fields";
import {
  removeCelebrity,
  saveCelebrity,
  type CelebrityFormState,
} from "@/app/admin/(panel)/celebrities/actions";
import type { Celebrity } from "@/lib/types";
import styles from "@/app/admin/panel.module.css";

export function CelebrityForm({ celebrity }: { celebrity?: Celebrity }) {
  const [state, action] = useActionState<CelebrityFormState, FormData>(
    saveCelebrity,
    {},
  );
  const errors = state.errors;
  const draft = state.values;

  return (
    <>
      <FormError message={errors?.form} />
      <ErrorSummary errors={errors} />
      <form action={action} id="entity-form">
        {celebrity ? <input type="hidden" name="id" value={celebrity.id} /> : null}
        <div className={styles.formGrid}>
          <TextField name="name" label="Name" defaultValue={draft?.name ?? celebrity?.name} errors={errors} required />
          <NumberField name="looks" label="Published looks" defaultValue={draft?.looks ?? celebrity?.looks ?? 0} errors={errors} />
          <NumberField name="averageSaving" label="Average saving %" defaultValue={draft?.averageSaving ?? celebrity?.averageSaving ?? 0} errors={errors} />
          <NumberField name="low" label="Cheapest look ₹" defaultValue={draft?.low ?? celebrity?.low ?? 0} errors={errors} />
          <NumberField name="high" label="Dearest look ₹" defaultValue={draft?.high ?? celebrity?.high ?? 0} errors={errors} />
          <TextField
            name="brands"
            label="Brands"
            hint="Comma separated"
            defaultValue={draft?.brands ?? celebrity?.brands.join(", ")}
            errors={errors}
            wide
          />
          <CheckField name="trending" label="Trending" defaultChecked={draft?.trending ?? celebrity?.trending} />
          <CheckField name="newArchive" label="New archive" defaultChecked={draft?.newArchive ?? celebrity?.newArchive} />
          <TextAreaField
            name="bio"
            label="Bio"
            hint="One paragraph per line. Leave empty to generate one."
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
        <form action={removeCelebrity} className={styles.formBar}>
          <input type="hidden" name="id" value={celebrity.id} />
          <button className={styles.danger} type="submit">Delete this celebrity</button>
        </form>
      ) : null}
    </>
  );
}
