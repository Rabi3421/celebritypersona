"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  FormError,
  NumberField,
  SaveButton,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/admin/form/Fields";
import {
  removeTrendingSearch,
  saveTrendingSearch,
  type TrendingFormState,
} from "@/app/admin/(panel)/trending/actions";
import type { TrendingSearch } from "@/lib/types";
import styles from "@/app/admin/panel.module.css";

const INTENTS = ["Celebrity", "Occasion", "Budget", "Brand", "How to"] as const;

export function TrendingForm({ search }: { search?: TrendingSearch }) {
  const [state, action] = useActionState<TrendingFormState, FormData>(
    saveTrendingSearch,
    {},
  );
  const errors = state.errors;

  return (
    <>
      <FormError message={errors?.form} />
      <form action={action} id="entity-form">
        {search ? <input type="hidden" name="original" value={search.term} /> : null}
        <div className={styles.formGrid}>
          <TextField name="term" label="Search term" defaultValue={search?.term} errors={errors} required />
          <SelectField name="intent" label="Intent" options={INTENTS} defaultValue={search?.intent} errors={errors} />
          <NumberField name="volume" label="Volume" defaultValue={search?.volume ?? 0} errors={errors} />
          <NumberField name="changePct" label="Change %" defaultValue={search?.changePct ?? 0} errors={errors} />
          <TextField name="href" label="Answers to" hint="Where the row links" defaultValue={search?.href} errors={errors} wide required />
          <TextAreaField name="answer" label="Answer" defaultValue={search?.answer} errors={errors} rows={3} />
        </div>
        <div className={styles.formBar}>
          <SaveButton>{search ? "Save changes" : "Create term"}</SaveButton>
          <Link className={styles.ghost} href="/admin/trending">Cancel</Link>
        </div>
      </form>
      {search ? (
        <form action={removeTrendingSearch} className={styles.formBar}>
          <input type="hidden" name="term" value={search.term} />
          <button className={styles.danger} type="submit">Delete this term</button>
        </form>
      ) : null}
    </>
  );
}
