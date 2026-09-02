"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OutfitImage, OutfitItem } from "@/lib/types";
import { nameSlug } from "@/lib/slugs";
import { compressImage, formatBytes, TARGET_BYTES } from "@/lib/image-compress";
import styles from "@/app/admin/panel.module.css";

type Spot = { x: number; y: number } | null;

/**
 * Uploads the photos for a look and places a numbered dot for each piece.
 *
 * Photos are stored in the order shown; the first is the cover, which is the
 * one every card leads with and the only one the dots belong to. Uploads go to
 * a folder named by the look's slug, read live out of the slug field, so one
 * look's photos always sit together in the bucket.
 *
 * Numbering follows the Pieces list below, so dot 1 is always the first row.
 * Piece names are read live from the form, which is why this listens for input
 * events rather than taking them as props: the list is edited independently.
 *
 * Everything is written into hidden inputs, so the parent form posts it with
 * the rest of the outfit and no extra request is needed on save.
 */
export function OutfitImageEditor({
  initialImages,
  initialItems,
}: {
  initialImages: OutfitImage[];
  initialItems: OutfitItem[];
}) {
  const [images, setImages] = useState<OutfitImage[]>(initialImages);
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [names, setNames] = useState<string[]>(
    initialItems.length ? initialItems.map((item) => item.name) : [""],
  );
  const [spots, setSpots] = useState<Spot[]>(
    initialItems.map((item) => item.hotspot ?? null),
  );
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  /**
   * Paths uploaded during this edit. Nothing saved points at them yet, so
   * taking one back can delete the file straight away. Photos the look was
   * opened with are not in here: those are only unlinked from the form, and
   * the file goes when the save confirms they are gone.
   */
  const freshRef = useRef(new Set<string>());

  /** Writes what a photo shows and who took it. Held on the image itself, so
   *  reordering or making another photo the cover carries it along. */
  const describe = useCallback(
    (index: number, field: "alt" | "credit", value: string) => {
      setImages((current) =>
        current.map((image, i) => (i === index ? { ...image, [field]: value } : image)),
      );
    },
    [],
  );

  /** Mirror the Pieces rows so the dots and the list always agree. */
  const syncNames = useCallback(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const inputs = form.querySelectorAll<HTMLInputElement>(
      'input[name^="items."][name$=".name"]',
    );
    setNames(Array.from(inputs, (input) => input.value));
  }, []);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const handler = () => syncNames();
    form.addEventListener("input", handler);
    form.addEventListener("click", handler);
    const first = requestAnimationFrame(handler);
    return () => {
      form.removeEventListener("input", handler);
      form.removeEventListener("click", handler);
      cancelAnimationFrame(first);
    };
  }, [syncNames]);

  /** The slug the editor has typed, which names the storage folder. */
  const currentSlug = () => {
    const form = rootRef.current?.closest("form");
    const field = form?.querySelector<HTMLInputElement>('input[name="slug"]');
    return nameSlug(field?.value ?? "");
  };

  async function upload(files: File[]) {
    const slug = currentSlug();
    if (!slug) {
      setError("Fill in the slug first — it names the folder these photos go into.");
      return;
    }

    setError(null);
    setSaved(null);
    let from = 0;
    let to = 0;

    // Sequential on purpose: a look has a handful of photos, and one failure
    // should not leave the others in limbo.
    for (const [index, file] of files.entries()) {
      const label = files.length > 1 ? ` (${index + 1} of ${files.length})` : "";
      try {
        // Shrunk here rather than on the way out of the server, so the
        // original never leaves this machine.
        setBusy(`Optimising${label}…`);
        const shrunk = await compressImage(file);
        from += shrunk.from;
        to += shrunk.to;

        setBusy(`Uploading${label}…`);
        const body = new FormData();
        body.append("file", shrunk.file);
        body.append("folder", "outfits");
        body.append("slug", slug);
        const response = await fetch("/api/admin/upload", { method: "POST", body });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Upload failed.");
        freshRef.current.add(data.path);
        setImages((current) => [...current, { url: data.url, path: data.path }]);
      } catch (cause) {
        setError(
          `${file.name}: ${cause instanceof Error ? cause.message : "Upload failed."}`,
        );
        break;
      }
    }

    setBusy(null);
    if (to > 0) {
      setSaved(
        `${formatBytes(from)} → ${formatBytes(to)}${to > TARGET_BYTES * files.length ? " — as small as this photo goes without visible damage" : ""}`,
      );
    }
  }

  /** Deletes the file behind a photo, but only one this session put there. */
  async function discard(image: OutfitImage) {
    if (!freshRef.current.has(image.path)) return;
    freshRef.current.delete(image.path);
    try {
      const response = await fetch(
        `/api/admin/upload?path=${encodeURIComponent(image.path)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Delete failed.");
      }
    } catch (cause) {
      // The photo is out of the form either way; say so, because the file is
      // now sitting in the bucket with nothing pointing at it.
      setError(
        `Removed from the look, but the file is still in storage. ${
          cause instanceof Error ? cause.message : ""
        }`.trim(),
      );
    }
  }

  function removeAt(index: number) {
    const going = images[index];
    setImages((current) => current.filter((_, i) => i !== index));
    setShown((current) => (current >= index && current > 0 ? current - 1 : current));
    setSaved(null);
    setError(null);
    if (going) void discard(going);
  }

  /** Promoting a photo to cover moves it to the front; the dots stay where
   *  they were placed, so check them against the new cover. */
  function makeCover(index: number) {
    setImages((current) => [
      current[index],
      ...current.filter((_, i) => i !== index),
    ]);
    setShown(0);
  }

  function place(event: React.MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - box.left) / box.width) * 1000) / 10;
    const y = Math.round(((event.clientY - box.top) / box.height) * 1000) / 10;
    setSpots((current) => {
      const next = [...current];
      while (next.length < names.length) next.push(null);
      next[active] = { x, y };
      return next;
    });
    setActive((current) => Math.min(current + 1, Math.max(names.length - 1, 0)));
  }

  const spotFor = (index: number) => spots[index] ?? null;
  const placed = names.filter((_, index) => spotFor(index)).length;
  const onCover = shown === 0;
  const current = images[shown];

  return (
    <div className={styles.repeat} ref={rootRef}>
      <div className={styles.repeatHead}>
        <h2>Photos</h2>
        <span>
          {images.length
            ? `${images.length} ${images.length === 1 ? "photo" : "photos"} · ${placed} of ${names.length} ${names.length === 1 ? "dot" : "dots"} placed`
            : "JPEG, PNG, WebP or AVIF — resized and compressed on the way in"}
        </span>
      </div>

      {error ? <p className={styles.bad}>{error}</p> : null}
      {saved && !error ? <p className={styles.shrunk}>Compressed {saved}</p> : null}

      <div className={styles.uploadRow}>
        <label className={styles.ghost}>
          {busy ?? (images.length ? "Add more photos" : "Choose photos")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            hidden
            disabled={Boolean(busy)}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length) upload(files);
              event.target.value = "";
            }}
          />
        </label>
        {images.length ? (
          <button
            className={styles.ghost}
            type="button"
            onClick={() => {
              const going = images;
              setImages([]);
              setShown(0);
              setSpots(names.map(() => null));
              setSaved(null);
              setError(null);
              void Promise.all(going.map(discard));
            }}
          >
            Remove all
          </button>
        ) : null}
      </div>

      {images.length ? (
        <>
          <div className={styles.shots}>
            {images.map((image, index) => (
              <div
                className={
                  index === shown ? `${styles.shot} ${styles.shotOn}` : styles.shot
                }
                key={image.path || image.url}
              >
                <button type="button" onClick={() => setShown(index)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt="" />
                  <b>{index === 0 ? "Cover" : index + 1}</b>
                </button>
                <span className={styles.shotBar}>
                  {index === 0 ? (
                    <em>dots here</em>
                  ) : (
                    <button type="button" onClick={() => makeCover(index)}>
                      Make cover
                    </button>
                  )}
                  <button type="button" onClick={() => removeAt(index)}>
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>

          {/* Uncontrolled, and keyed to the photo. The form listens for `input`
              to mirror the piece names, and that re-render lands mid-keystroke:
              a controlled box here reverts every character as it is typed.
              The key remounts the box when another photo is selected, so it
              still shows that photo's words. */}
          <div className={styles.shotMeta}>
            <label>
              <span>Alt text · photo {shown + 1}</span>
              <input
                key={`alt-${images[shown]?.path ?? shown}`}
                type="text"
                maxLength={160}
                defaultValue={images[shown]?.alt ?? ""}
                placeholder="Ritika Nayak in a pink floral draped jumpsuit by Ewoke Studio"
                onChange={(event) => describe(shown, "alt", event.target.value)}
              />
              <small>
                What the photo shows, for a reader who cannot see it and for
                image search. Empty falls back to the celebrity and the event.
              </small>
            </label>
            <label>
              <span>Photo credit</span>
              <input
                key={`credit-${images[shown]?.path ?? shown}`}
                type="text"
                maxLength={120}
                defaultValue={images[shown]?.credit ?? ""}
                placeholder="Instagram / @ritikanayak"
                onChange={(event) => describe(shown, "credit", event.target.value)}
              />
              <small>Shown on the photo. Empty reads “Photo · Editorial archive”.</small>
            </label>
          </div>

          <p className={styles.dotHint}>
            {onCover ? (
              <>
                Click the cover photo to place dot {active + 1}
                {names[active] ? ` for “${names[active]}”` : ""}. Pick a piece
                below to move its dot.
              </>
            ) : (
              <>
                Photo {shown + 1} of {images.length}. Dots live on the cover
                photo — make this the cover to place them here.
              </>
            )}
          </p>

          {onCover ? (
            <div className={styles.dotPickers}>
              {names.map((name, index) => (
                <button
                  className={
                    index === active
                      ? `${styles.dotPick} ${styles.dotPickOn}`
                      : styles.dotPick
                  }
                  type="button"
                  key={index}
                  onClick={() => setActive(index)}
                >
                  <i>{index + 1}</i>
                  {name || `Piece ${index + 1}`}
                  {spotFor(index) ? <em>placed</em> : <em>not placed</em>}
                </button>
              ))}
            </div>
          ) : null}

          <div
            className={onCover ? styles.dotFrame : `${styles.dotFrame} ${styles.dotFrameIdle}`}
            onClick={onCover ? place : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.url} alt="" />
            {onCover
              ? names.map((name, index) => {
                  const spot = spotFor(index);
                  if (!spot) return null;
                  return (
                    <span
                      className={
                        index === active
                          ? `${styles.dot} ${styles.dotOn}`
                          : styles.dot
                      }
                      key={index}
                      style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                      title={name}
                    >
                      {index + 1}
                    </span>
                  );
                })
              : null}
          </div>
        </>
      ) : (
        <div className={styles.dotEmpty}>
          No photos yet. The public page falls back to a placeholder.
        </div>
      )}

      {images.map((image, index) => (
        <span key={image.path || image.url}>
          <input type="hidden" name={`images.${index}.url`} value={image.url} />
          <input type="hidden" name={`images.${index}.path`} value={image.path} />
          <input type="hidden" name={`images.${index}.alt`} value={image.alt ?? ""} />
          <input type="hidden" name={`images.${index}.credit`} value={image.credit ?? ""} />
        </span>
      ))}
      {names.map((_, index) => {
        const spot = spotFor(index);
        return (
          <span key={index}>
            <input
              type="hidden"
              name={`items.${index}.hotspotX`}
              value={spot ? spot.x : ""}
            />
            <input
              type="hidden"
              name={`items.${index}.hotspotY`}
              value={spot ? spot.y : ""}
            />
          </span>
        );
      })}
    </div>
  );
}
