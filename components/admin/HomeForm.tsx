"use client";

import { useActionState } from "react";
import {
  ErrorSummary,
  FormError,
  SaveButton,
  TextAreaField,
  TextField,
} from "@/components/admin/form/Fields";
import { RepeatableRows } from "@/components/admin/form/RepeatableRows";
import { saveHome, type HomeFormState } from "@/app/admin/(panel)/home/actions";
import type { HomeContent } from "@/lib/types";
import styles from "@/app/admin/panel.module.css";

/** Read-only figures the homepage now works out for itself, shown so an editor
 *  can see what publishing a look moved without hunting for a form field. */
export type HomeComputed = { label: string; value: string; hint: string }[];

export function HomeForm({
  home,
  computed,
  saved,
}: {
  home: HomeContent;
  computed: HomeComputed;
  saved?: boolean;
}) {
  const [state, action] = useActionState<HomeFormState, FormData>(saveHome, {});
  const errors = state.errors;

  return (
    <>
      {saved ? (
        <div className={styles.notice}>
          <strong>Saved</strong>
          <p>The homepage has been updated and the public pages revalidated.</p>
        </div>
      ) : null}
      <FormError message={errors?.form} />
      <ErrorSummary errors={errors} />

      <section className={styles.section} style={{ marginTop: 0 }}>
        <div className={styles.sectionHead}>
          <h2>Counted from the archive</h2>
          <span>Not editable — publish a look and these move</span>
        </div>
        <div className={styles.tiles}>
          {computed.map((tile) => (
            <div className={styles.tile} key={tile.label}>
              <span>{tile.label}</span>
              <b>{tile.value}</b>
              <small>{tile.hint}</small>
            </div>
          ))}
        </div>
      </section>

      <form action={action} id="entity-form">
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>How swaps work</h2>
            <span>Beside the swap demo</span>
          </div>
          <div className={styles.formGrid}>
            <RepeatableRows name="swapSteps" title="How it works" columns="70px minmax(0,1fr) minmax(0,2fr)"
              error={errors?.swapSteps} initial={home.swapSteps} addLabel="Add a step"
              fields={[{ key: "n", label: "No." }, { key: "title", label: "Title" }, { key: "body", label: "Body" }]} />
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Campaign band</h2>
            <span>The look count is filled in for you</span>
          </div>
          <div className={styles.formGrid}>
            <TextField name="campaign.eyebrow" label="Eyebrow" defaultValue={home.campaign.eyebrow} errors={errors} />
            <TextField name="campaign.title" label="Title" defaultValue={home.campaign.title} errors={errors} />
            <TextAreaField name="campaign.body" label="Body" hint="Follows the wedding look count, e.g. “decoded — with swaps you can order in time.”"
              defaultValue={home.campaign.body} errors={errors} rows={3} />
            <TextField name="campaign.cta" label="Button" defaultValue={home.campaign.cta} errors={errors} />
            <TextField name="campaign.href" label="Button link" defaultValue={home.campaign.href} errors={errors} />
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.formGrid}>
            <RepeatableRows name="trustPoints" title="Trust points" columns="70px minmax(0,1fr) minmax(0,2fr)"
              error={errors?.trustPoints} initial={home.trustPoints} addLabel="Add a point"
              fields={[{ key: "n", label: "No." }, { key: "title", label: "Title" }, { key: "body", label: "Body" }]} />
            <RepeatableRows name="reels" title="Reels" columns="120px minmax(0,1fr)"
              error={errors?.reels} initial={home.reels} addLabel="Add a reel"
              fields={[{ key: "views", label: "Views" }, { key: "caption", label: "Caption" }]} />
          </div>
        </section>

        <div className={styles.formBar}>
          <SaveButton>Save homepage</SaveButton>
        </div>
      </form>
    </>
  );
}
