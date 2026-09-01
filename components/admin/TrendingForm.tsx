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
  const draft = state.values;

  return (
    <>
      <FormError message={errors?.form} />
      <ErrorSummary errors={errors} />
      <form action={action} id="entity-form">
        {search ? <input type="hidden" name="original" value={search.term} /> : null}
        <div className={styles.formGrid}>
          <TextField name="term" label="Search term" defaultValue={draft?.term ?? search?.term} errors={errors} required />
          <SelectField name="intent" label="Intent" options={INTENTS} defaultValue={draft?.intent ?? search?.intent} errors={errors} />
          <NumberField name="volume" label="Volume" defaultValue={draft?.volume ?? search?.volume ?? 0} errors={errors} />
          <NumberField name="changePct" label="Change %" defaultValue={draft?.changePct ?? search?.changePct ?? 0} errors={errors} />
          <TextField name="href" label="Answers to" hint="Where the row links" defaultValue={draft?.href ?? search?.href} errors={errors} wide required />
          <TextAreaField name="answer" label="Answer" defaultValue={draft?.answer ?? search?.answer} errors={errors} rows={3} />
        </div>
        <div className={styles.formBar}>
          <SaveButton>{search ? "Save changes" : "Create term"}</SaveButton>
          <Link className={styles.ghost} href="/admin/trending">Cancel</Link>
        </div>
      </form>
      {search ? (
        <form
          action={removeTrendingSearch}
          className={styles.formBar}
          onSubmit={(event) => {
            if (!window.confirm("Remove this row from the public leaderboard?")) event.preventDefault();
          }}
        >
          <input type="hidden" name="term" value={search.term} />
          <button className={styles.danger} type="submit">Delete this term</button>
        </form>
      ) : null}
    </>
  );
}
