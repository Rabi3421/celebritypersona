"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ErrorSummary, FormError, SaveButton, TextAreaField } from "@/components/admin/form/Fields";
import { HubSeoSection } from "@/components/admin/seo/HubSeoSection";
import type { HubFormState } from "@/lib/hub-form";
import type { HubSeo } from "@/lib/types";
import styles from "@/app/admin/panel.module.css";

/**
 * The editor's half of a brand or budget page: an intro and the search
 * fields. Everything else on those pages is counted from the outfits.
 */
export function HubRecordForm({
  action: save,
  hidden,
  record,
  introHint,
  path,
  looks,
  fallbackTitle,
  fallbackDescription,
  backHref,
}: {
  action: (previous: HubFormState, form: FormData) => Promise<HubFormState>;
  /** Identifies the record: the brand id or the budget cap. */
  hidden: Record<string, string | number>;
  record?: HubSeo & { intro?: string[] };
  introHint: string;
  path: string;
  looks: number;
  fallbackTitle: string;
  fallbackDescription: string;
  backHref: string;
}) {
  const [state, action] = useActionState<HubFormState, FormData>(save, {});
  const errors = state.errors;
  const draft = state.values;

  return (
    <>
      <FormError message={errors?.form} />
      <ErrorSummary errors={errors} />
      {state.saved ? (
        <p className={styles.notice} role="status">
          <strong>Saved.</strong>
        </p>
      ) : null}
      <form action={action} id="entity-form">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div className={styles.formGrid}>
          <TextAreaField
            name="intro"
            label="Intro"
            hint={introHint}
            defaultValue={draft?.intro ?? record?.intro?.join("\n")}
            errors={errors}
            rows={8}
          />
          <HubSeoSection
            formId="entity-form"
            introName="intro"
            path={path}
            looks={looks}
            fallbackTitle={fallbackTitle}
            fallbackDescription={fallbackDescription}
            defaults={{
              primaryKeyword: draft?.primaryKeyword ?? record?.primaryKeyword,
              seoTitle: draft?.seoTitle ?? record?.seoTitle,
              seoDescription: draft?.seoDescription ?? record?.seoDescription,
            }}
            errors={errors}
          />
        </div>
        <div className={styles.formBar}>
          <SaveButton>Save changes</SaveButton>
          <Link className={styles.ghost} href={path} target="_blank">
            View page ↗
          </Link>
          <Link className={styles.ghost} href={backHref}>
            Back
          </Link>
        </div>
      </form>
    </>
  );
}
