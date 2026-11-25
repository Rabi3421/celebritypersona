"use client";

import { useActionState } from "react";
import { ErrorSummary, FormError, SaveButton, TextAreaField, TextField } from "@/components/admin/form/Fields";
import { queueLookJob, type LookJobFormState } from "@/app/admin/(panel)/outfits/from-links/actions";
import { MAX_ALTERNATE_URLS, MAX_BUY_URLS } from "@/lib/look-jobs";
import styles from "@/app/admin/panel.module.css";

/**
 * The same fields as the editor's Google Sheet, in the same order. Research,
 * keywords, the write-up and swaps are the runner's job; the real photo is
 * added in the draft.
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
            name="celebrity"
            label="Celebrity"
            hint="Who wore it, as you want the name on the site, e.g. Shakti Mohan."
            defaultValue={state.values?.celebrity}
            errors={errors}
            placeholder="Celebrity name"
            required
          />
          <TextField
            name="celebrityInstagram"
            label="Celebrity's Instagram (optional)"
            hint="Their profile, e.g. https://www.instagram.com/handle/ — used for the photo credit."
            defaultValue={state.values?.celebrityInstagram}
            errors={errors}
            placeholder="https://www.instagram.com/…"
          />
          <TextField
            name="labelUrl"
            label="Label's website (optional)"
            hint="The brand that made the outfit, e.g. https://www.missmosa.in/"
            defaultValue={state.values?.labelUrl}
            errors={errors}
            placeholder="https://…"
          />
          <TextAreaField
            name="buyUrls"
            label="Original outfit link"
            hint={`The original piece's page, one link per line (up to ${MAX_BUY_URLS}, one per piece). Tracking tags are removed for you.`}
            defaultValue={state.values?.buyUrls}
            errors={errors}
            placeholder="https://…"
            rows={2}
            wide
            required
          />
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
            name="alternateUrls"
            label="Alternate links (optional)"
            hint={`Up to ${MAX_ALTERNATE_URLS}, one per line: the same piece at another shop, or a cheaper look-alike. Research checks which it is.`}
            defaultValue={state.values?.alternateUrls}
            errors={errors}
            placeholder="https://…"
            rows={2}
            wide
          />
        </div>
        <div className={styles.formBar}>
          <SaveButton>Start research</SaveButton>
        </div>
      </form>
    </>
  );
}
