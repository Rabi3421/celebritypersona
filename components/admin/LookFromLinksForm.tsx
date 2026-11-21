"use client";

import { useActionState, useEffect, useState } from "react";
import { ErrorSummary, FormError, SaveButton, TextAreaField, TextField } from "@/components/admin/form/Fields";
import { useAdminSession } from "@/components/admin/session/AdminSession";
import { queueLookJob, type LookJobFormState } from "@/app/admin/(panel)/outfits/from-links/actions";
import { compressImage, formatBytes } from "@/lib/image-compress";
import { MAX_BUY_URLS, newLookJobId } from "@/lib/look-jobs";
import styles from "@/app/admin/panel.module.css";
import local from "./look-jobs.module.css";

type Photo = { url: string; path: string };

/**
 * The three things only the editor can supply — the post, the buying link(s)
 * and the real photo — and nothing else. Research, keywords, the write-up,
 * swaps and the pin are the runner's job; the editor sees them in the draft.
 */
export function LookFromLinksForm() {
  const [state, action] = useActionState<LookJobFormState, FormData>(queueLookJob, {});
  // Names the photo's inbox folder. Made once, in the browser, so nothing the
  // page re-renders (a session renewal, a refused submit) can change it after
  // the photo has gone up.
  const [uploadId] = useState(() => newLookJobId((size) => crypto.getRandomValues(new Uint8Array(size))));
  const { adminFetch } = useAdminSession();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const errors = state.errors;

  async function take(file: File | undefined) {
    if (!file || busy) return;
    if (!file.type.startsWith("image/")) {
      setProblem("That is not an image. Use the JPEG, PNG or WebP you saved from the post.");
      return;
    }
    setProblem(null);
    try {
      setBusy("Optimising…");
      const shrunk = await compressImage(file);
      setBusy("Uploading…");
      const body = new FormData();
      body.append("file", shrunk.file);
      body.append("folder", "inbox");
      body.append("slug", uploadId);
      body.append("position", "1");
      const response = await adminFetch("/api/admin/upload", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Upload failed.");
      const previous = photo;
      setPhoto({ url: data.url, path: data.path });
      if (previous) void discard(previous);
      setProblem(`Uploaded (${formatBytes(shrunk.from)} → ${formatBytes(shrunk.to)}).`);
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  }

  async function discard(target: Photo) {
    try {
      await adminFetch(`/api/admin/upload?path=${encodeURIComponent(target.path)}`, { method: "DELETE" });
    } catch {
      // An orphaned inbox photo is untidy, not harmful.
    }
  }

  // Ctrl+V anywhere on the page takes a copied image.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith("image/"));
      if (file) {
        event.preventDefault();
        void take(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  return (
    <>
      <FormError message={errors?.form} />
      <ErrorSummary errors={errors} />
      <form action={action} id="entity-form">
        <input type="hidden" name="photoPath" value={photo?.path ?? ""} />
        <input type="hidden" name="photoUrl" value={photo?.url ?? ""} />
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
          <TextAreaField
            name="note"
            label="Anything you already know (optional)"
            hint="The event, the date, who styled it — it gives the research a head start. It is still checked against sources."
            defaultValue={state.values?.note}
            errors={errors}
            rows={2}
            wide
          />

          <div className={`${styles.field} ${styles.wide}`}>
            <label htmlFor="look-photo">The photo</label>
            <label
              className={`${local.drop} ${over ? local.dropOver : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setOver(false);
                void take(event.dataTransfer.files[0]);
              }}
            >
              <input
                id="look-photo"
                className={styles.srOnly}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(event) => {
                  void take(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={local.preview} src={photo.url} alt="The photo for this look" />
              ) : null}
              <span>
                {busy ??
                  (photo
                    ? "Drop or paste another photo to replace it."
                    : "Drag the photo you saved from the post here, click to choose it, or paste it (Ctrl+V).")}
              </span>
            </label>
            {problem ? (
              <small className={problem.startsWith("Uploaded") ? styles.ok : styles.bad} role="status">
                {problem}
              </small>
            ) : null}
            {errors?.photo ? <small className={styles.bad}>{errors.photo}</small> : null}
            <small className={local.hint}>
              Optional now, but the draft cannot be published without it. Use the real photo from the post — the
              runner never generates a picture of the celebrity.
            </small>
          </div>
        </div>
        <div className={styles.formBar}>
          <SaveButton>{busy ? "Wait for the photo…" : "Start research"}</SaveButton>
        </div>
      </form>
    </>
  );
}
