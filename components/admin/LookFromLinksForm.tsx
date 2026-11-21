"use client";

import { useActionState } from "react";
import { ErrorSummary, FormError, SaveButton, TextAreaField, TextField } from "@/components/admin/form/Fields";
import { queueLookJob, type LookJobFormState } from "@/app/admin/(panel)/outfits/from-links/actions";
import { MAX_BUY_URLS } from "@/lib/look-jobs";
import styles from "@/app/admin/panel.module.css";

/**
 * Just the two links: the post and where to buy it. Research, keywords, the
 * write-up and swaps are the runner's job; the editor sees them in the draft
 * and adds the real photo there before publishing.
 */
export function LookFromLinksForm() {
  const [state, action] = useActionState<LookJobFormState, FormData>(queueLookJob, {});
  const errors = state.errors;

  return (
    <>
      <FormError message={errors?.form} />
      <ErrorSummary errors={errors} />
      <form action={action} id="entity-form">
        <div className={styles.formGrid}>
          <TextField
            name="instagramUrl"
            label="Instagram post"
            hint="The post or reel the celebrity wore it in, e.g. https://www.instagram.com/p/…"
            defaultValue={state.values?.instagramUrl}
            errors={errors}
            placeholder="https://www.instagram.com/p/…"
            wide
            required
          />
          <TextAreaField
            name="buyUrls"
            label="Where to buy it"
            hint={`The original piece's page, one link per line (up to ${MAX_BUY_URLS}, one per piece). Tracking tags are removed for you.`}
            defaultValue={state.values?.buyUrls}
            errors={errors}
            placeholder="https://…"
            rows={3}
            wide
            required
          />
        </div>
        <div className={styles.formBar}>
          <SaveButton>Start research</SaveButton>
        </div>
      </form>
    </>
  );
}
