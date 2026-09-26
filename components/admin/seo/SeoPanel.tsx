"use client";

import { finalDescription, headline } from "@/lib/outfit-seo";
import { seoChecks, type SeoCheck } from "@/lib/seo-checks";
import { site } from "@/lib/site-config";
import styles from "@/app/admin/panel.module.css";
import { useOutfitSeo } from "./OutfitSeoContext";

/**
 * The live SEO panel beside the outfit form: the search result as Google would
 * print it, and the checklist that decides whether the look can go live.
 *
 * Both are computed from the form as it stands, with the page's own title and
 * description functions, so the preview includes every fallback the page
 * would use and the checks match what the save action enforces.
 */
export function SeoPanel() {
  const { snapshot, owners, outfitId } = useOutfitSeo();
  if (!snapshot) return <aside className={styles.seoPanel} aria-busy="true" />;

  const title = headline(snapshot);
  const description = finalDescription(snapshot);
  const host = new URL(site.url).host;
  const checks = seoChecks(snapshot, { id: outfitId, owners });
  const critical = checks.filter((check) => check.level === "critical");
  const warnings = checks.filter((check) => check.level === "warning");
  const failing = critical.filter((check) => !check.ok).length;

  return (
    <aside className={styles.seoPanel} aria-label="Search appearance and SEO checklist">
      <section>
        <h2>Google preview</h2>
        <div className={styles.serp}>
          <cite>
            {host} › outfits › {snapshot.slug || "…"}
          </cite>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <p className={styles.serpMeta}>
          <span className={title.length > 60 ? styles.warn : undefined}>Title {title.length}/60</span>
          {" · "}
          <span className={description.length > 160 ? styles.warn : undefined}>
            Description {description.length}/160
          </span>
          {snapshot.seoTitle ? null : " · title is the fallback"}
          {snapshot.seoDescription ? null : " · description is the fallback"}
        </p>
      </section>

      <section>
        <h2>
          Checklist{" "}
          <span className={failing ? styles.bad : styles.save}>
            {failing ? `${failing} blocking` : "ready to publish"}
          </span>
        </h2>
        <CheckList title="Must pass to publish" checks={critical} />
        <CheckList title="Worth fixing" checks={warnings} />
      </section>
    </aside>
  );
}

function CheckList({ title, checks }: { title: string; checks: SeoCheck[] }) {
  return (
    <>
      <h3>{title}</h3>
      <ul className={styles.checks}>
        {checks.map((check) => {
          const tone = check.ok ? "pass" : check.level === "critical" ? "fail" : "warn";
          return (
            <li key={check.id} className={styles[`check_${tone}`]}>
              <i aria-hidden="true">{check.ok ? "✓" : check.level === "critical" ? "✕" : "!"}</i>
              <span>
                {check.label}
                <span className={styles.srOnly}>
                  {check.ok ? " — passes" : check.level === "critical" ? " — fails" : " — warning"}
                </span>
                {check.detail ? <small>{check.detail}</small> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
