"use client";

import { generateDescription, generateTitle } from "@/lib/outfit-seo";
import styles from "@/app/admin/panel.module.css";
import { fillField, useOutfitSeo } from "./OutfitSeoContext";

const SPEC = {
  seoTitle: { label: "Search title", max: 60, generate: generateTitle },
  seoDescription: { label: "Search description", max: 160, generate: generateDescription },
} as const;

/**
 * The search title or description, with a Generate button and a live count.
 *
 * Generate fills the box from the lead piece and the primary keyword; the
 * result is an ordinary draft the editor can rewrite. The count turns amber
 * over the limit, and the save refuses anything longer.
 */
export function SeoTextField({
  name,
  defaultValue,
  hint,
  error,
}: {
  name: keyof typeof SPEC;
  defaultValue?: string;
  hint: string;
  error?: string;
}) {
  const { formId, snapshot } = useOutfitSeo();
  const { label, max, generate } = SPEC[name];
  const typed = snapshot?.[name] ?? defaultValue ?? "";
  const over = typed.length > max;

  const control =
    name === "seoDescription" ? (
      <textarea id={name} name={name} rows={3} defaultValue={defaultValue} aria-invalid={error ? true : undefined} />
    ) : (
      <input id={name} name={name} defaultValue={defaultValue} aria-invalid={error ? true : undefined} />
    );

  return (
    <div className={`${styles.field} ${styles.wide}`}>
      <label htmlFor={name}>
        {label} <span className={over ? styles.warn : styles.muted}>{typed.length}/{max}</span>
      </label>
      <div className={styles.inlineField}>
        {control}
        <button
          type="button"
          className={styles.ghost}
          disabled={!snapshot}
          onClick={() => snapshot && fillField(formId, name, generate(snapshot))}
        >
          Generate
        </button>
      </div>
      <small>{hint}</small>
      {error ? <p className={styles.bad}>{error}</p> : null}
    </div>
  );
}
