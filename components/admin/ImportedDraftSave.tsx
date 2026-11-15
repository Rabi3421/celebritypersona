"use client";
import { useOutfitSeo } from "@/components/admin/seo/OutfitSeoContext";
import { readOutfitDraft } from "@/lib/outfit-form-fields";
import { validateDraft } from "@/lib/outfit-research";
import { missingRecords } from "@/lib/archive-records";
import { SaveButton } from "@/components/admin/form/Fields";

export function ImportedDraftSave({ known }: { known: { celebrities: { name: string }[]; occasions: { name: string }[]; brands: { name: string }[] } }) {
  const { snapshot, formId } = useOutfitSeo();
  const form = typeof document === "undefined" ? null : document.getElementById(formId);
  // The provider publishes after hidden inputs and repeated rows settle.
  const result = snapshot && form instanceof HTMLFormElement ? validateDraft(readOutfitDraft(new FormData(form))) : null;
  const errors = result && !result.success ? [...new Set(result.error.issues.map((i) => i.message))] : [];
  const missing = snapshot ? missingRecords(known, [snapshot]) : { celebrities: [], occasions: [], brands: [] };
  const newNames = Object.entries(missing).flatMap(([kind, names]) => names.map((name) => `${kind}: ${name}`));
  return <div>
    <p>Research is applied locally. Saving creates a draft only; publishing remains a separate manual step in the saved editor.</p>
    {errors.length ? <div role="status"><strong>Complete these fields before saving:</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
    {newNames.length ? <div><strong>New archive records this save would create:</strong><ul>{newNames.map((name) => <li key={name}>{name}</li>)}</ul><label><input key={JSON.stringify(missing)} type="checkbox" name="importRelatedConfirmed" value={JSON.stringify(missing)} required /> I approve creating the listed celebrity, occasion and brand records.</label></div> : null}
    <p key={JSON.stringify(snapshot)}><label><input type="checkbox" name="importSaveConfirmed" required /> I reviewed this completed form and approve saving it as a new Draft.</label></p>
    {result?.success ? <SaveButton>Save as Draft</SaveButton> : <button type="button" disabled>Complete required fields to save</button>}
  </div>;
}
