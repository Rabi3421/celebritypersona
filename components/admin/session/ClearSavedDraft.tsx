"use client";

import { useEffect } from "react";
import { clearStoredDraft } from "./useFormAutosave";

/** Removes the autosaved copy of a form that has just been saved, on the page
 *  the save redirected to. Renders nothing. */
export function ClearSavedDraft({ draftKey }: { draftKey?: string }) {
  useEffect(() => {
    if (draftKey) clearStoredDraft(draftKey);
  }, [draftKey]);
  return null;
}
