"use client";

import { useEffect, useState } from "react";
import { hubChecks } from "@/lib/hub-seo";
import { clampDescription } from "@/lib/seo";
import { dollarsOnly } from "@/lib/outfit-seo";
import { site } from "@/lib/site-config";
import styles from "@/app/admin/panel.module.css";

type Values = { keyword: string; title: string; description: string; intro: string[] };

/**
 * Search appearance for a hub page — celebrity, occasion, brand or budget —
 * with the same live preview and checklist the outfit form has.
 *
 * The page's generated title and description arrive as props, computed on the
 * server by the page's own functions, so the preview shows exactly what an
 * empty field falls back to. The intro is read from the form's own intro box,
 * by name, as it is typed.
 */
export function HubSeoSection({
  formId,
  introName,
  path,
  looks,
  fallbackTitle,
  fallbackDescription,
  defaults,
  errors,
}: {
  formId: string;
  /** The name of the form's intro textarea: "bio" or "intro". */
  introName: string;
  path: string;
  looks: number;
  fallbackTitle: string;
  fallbackDescription: string;
  defaults: { primaryKeyword?: string; seoTitle?: string; seoDescription?: string };
  errors?: Record<string, string>;
}) {
  const [values, setValues] = useState<Values>({
    keyword: defaults.primaryKeyword ?? "",
    title: defaults.seoTitle ?? "",
    description: defaults.seoDescription ?? "",
    intro: [],
  });

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const read = () => {
      const data = new FormData(form);
      const field = (name: string) => String(data.get(name) ?? "").trim();
      setValues({
        keyword: field("primaryKeyword"),
        title: field("seoTitle"),
        description: field("seoDescription"),
        intro: field(introName).split("\n").map((line) => line.trim()).filter(Boolean),
      });
    };
    read();
    form.addEventListener("input", read);
    return () => form.removeEventListener("input", read);
  }, [formId, introName]);

  const title = values.title || fallbackTitle;
  const description = clampDescription(
    values.description && !dollarsOnly(values.description) ? values.description : fallbackDescription,
  );
  const checks = hubChecks({ keyword: values.keyword, title, description, intro: values.intro, looks });

  return (
    <>
      <h3 className={styles.subhead}>Search appearance</h3>
      <div className={`${styles.field} ${styles.wide}`}>
        <label htmlFor="primaryKeyword">Primary keyword</label>
        <input
          id="primaryKeyword"
          name="primaryKeyword"
          defaultValue={defaults.primaryKeyword}
          placeholder="e.g. rukmini vasanth outfits"
          autoComplete="off"
        />
        <small>The search this page should win. Checked against the title and intro; never shown on the page.</small>
        {errors?.primaryKeyword ? <p className={styles.bad}>{errors.primaryKeyword}</p> : null}
      </div>
      <div className={`${styles.field} ${styles.wide}`}>
        <label htmlFor="seoTitle">
          Search title (optional){" "}
          <span className={values.title.length > 60 ? styles.warn : styles.muted}>{values.title.length}/60</span>
        </label>
        <input id="seoTitle" name="seoTitle" defaultValue={defaults.seoTitle} placeholder={fallbackTitle} />
        <small>Empty uses the generated one, shown as the placeholder.</small>
        {errors?.seoTitle ? <p className={styles.bad}>{errors.seoTitle}</p> : null}
      </div>
      <div className={`${styles.field} ${styles.wide}`}>
        <label htmlFor="seoDescription">
          Search description (optional){" "}
          <span className={values.description.length > 160 ? styles.warn : styles.muted}>
            {values.description.length}/160
          </span>
        </label>
        <textarea id="seoDescription" name="seoDescription" rows={3} defaultValue={defaults.seoDescription} placeholder={fallbackDescription} />
        {errors?.seoDescription ? <p className={styles.bad}>{errors.seoDescription}</p> : null}
      </div>

      <div className={`${styles.wide} ${styles.hubSeoPanel}`}>
        <div className={styles.serp}>
          <cite>
            {new URL(site.url).host} › {path.split("/").filter(Boolean).join(" › ")}
          </cite>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <ul className={styles.checks}>
          {checks.map((check) => {
            const tone = check.ok ? "pass" : check.level === "critical" ? "fail" : "warn";
            return (
              <li key={check.id} className={styles[`check_${tone}`]}>
                <i aria-hidden="true">{check.ok ? "✓" : check.level === "critical" ? "✕" : "!"}</i>
                <span>
                  {check.label}
                  {check.detail ? <small>{check.detail}</small> : null}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
