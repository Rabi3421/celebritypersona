import { lines, text } from "@/lib/form-data";
import type { FieldErrors } from "@/lib/validation";

/** What a brand or budget form posted, echoed back so a rejected save keeps
 *  the typing. */
export type HubDraft = { intro: string; primaryKeyword: string; seoTitle: string; seoDescription: string };

export type HubFormState = { errors?: FieldErrors; values?: HubDraft; saved?: boolean };

/** The posted fields, as the draft to echo and as the input to validate. */
export function readHubForm(form: FormData) {
  const draft: HubDraft = {
    intro: String(form.get("intro") ?? ""),
    primaryKeyword: text(form, "primaryKeyword"),
    seoTitle: text(form, "seoTitle"),
    seoDescription: text(form, "seoDescription"),
  };
  return { draft, input: { ...draft, intro: lines(form, "intro") } };
}
