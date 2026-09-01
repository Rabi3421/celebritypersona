"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { submitPriceReport, type ReportState } from "@/app/actions/reports";
import { contacts } from "@/lib/site-config";
import { PRICE_REPORT_ISSUES, type PriceReportIssue } from "@/lib/types";
import styles from "./editorial.module.css";

const HINTS: Record<PriceReportIssue, string> = {
  "Price is wrong": "The number does not match the shop",
  "Link is dead": "It 404s or goes to the wrong product",
  "Sold out": "Listed as available but it is gone",
  "Wrong brand or piece": "We identified it incorrectly",
  "Swap suggestion": "You know a better alternative than ours",
};

export type ReportPrefill = {
  /** The look the reader came from, so they never have to find its address. */
  outfit?: string;
  outfitLabel?: string;
  issue?: PriceReportIssue;
  piece?: string;
};

/**
 * Posts straight to the price-reports collection the panel reads. It used to
 * compose a mailto: link, which meant a report only arrived if the reader had
 * a mail client configured and somebody was watching that inbox.
 *
 * It is a real form with a server action, so it submits without JavaScript
 * too; the email address stays on the page as a fallback, not as the mechanism.
 */
export function ReportPriceForm({ prefill }: { prefill?: ReportPrefill }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(
    submitPriceReport,
    {},
  );
  const [issue, setIssue] = useState<PriceReportIssue>(
    prefill?.issue ?? PRICE_REPORT_ISSUES[0],
  );
  const errors = state.errors;

  if (state.sent) {
    return (
      <div className={styles.form}>
        <div className={styles.heading}>
          <p>Received</p>
          <h2>Thank you — it is in the queue</h2>
        </div>
        <p className={styles.formNote}>
          Your report is in front of us now. We check reports against the shop
          itself, usually the same day, and the page changes rather than
          quietly disappearing. If you left an email we will tell you what we
          found.
        </p>
        <p className={styles.formNote}>
          <Link href="/outfits">Back to the looks →</Link>
        </p>
      </div>
    );
  }

  const suggesting = issue === "Swap suggestion";

  return (
    <form className={styles.form} action={action}>
      {errors?.form ? <p className={styles.formNote}>{errors.form}</p> : null}

      <div className={styles.field}>
        <label htmlFor="outfitSlug">Which page?</label>
        <small>
          Paste the address of the outfit page, or describe the look. Leave it
          empty if it is not about one look.
        </small>
        <input
          id="outfitSlug"
          name="outfitSlug"
          defaultValue={prefill?.outfit ?? ""}
          placeholder="celebritypersona.com/outfits/..."
          aria-invalid={errors?.outfitSlug ? true : undefined}
        />
        {prefill?.outfitLabel ? (
          <small>Reporting on: {prefill.outfitLabel}</small>
        ) : null}
        {errors?.outfitSlug ? <small>{errors.outfitSlug}</small> : null}
      </div>

      <div className={styles.field}>
        <label htmlFor="issue-0">What is wrong?</label>
        <div className={styles.choices}>
          {PRICE_REPORT_ISSUES.map((option, index) => (
            <label className={styles.choice} key={option}>
              <input
                type="radio"
                name="issue"
                id={`issue-${index}`}
                value={option}
                checked={issue === option}
                onChange={() => setIssue(option)}
              />
              <span>
                <strong>{option}</strong>
                <br />
                {HINTS[option]}
              </span>
            </label>
          ))}
        </div>
        {errors?.issue ? <small>{errors.issue}</small> : null}
      </div>

      <div className={styles.field}>
        <label htmlFor="piece">Which piece?</label>
        <small>Optional. The kurta, the bag, the earrings — whichever it is.</small>
        <input
          id="piece"
          name="piece"
          defaultValue={prefill?.piece ?? ""}
          placeholder="Ivory cotton kurta"
          aria-invalid={errors?.piece ? true : undefined}
        />
        {errors?.piece ? <small>{errors.piece}</small> : null}
      </div>

      <div className={styles.field}>
        <label htmlFor="detail">
          {suggesting ? "What should we swap it for?" : "What should it say?"}
        </label>
        <small>
          {suggesting
            ? "The brand and the piece you would recommend instead, and why it is a better match."
            : "If it is a price, the figure you can see right now. If it is a piece, the brand you think it actually is."}
        </small>
        <textarea
          id="detail"
          name="detail"
          required
          placeholder={
            suggesting
              ? "The Libas embroidered kurta is a much closer cut, and it is ₹1,299."
              : "₹1,499 on Myntra"
          }
          aria-invalid={errors?.detail ? true : undefined}
        />
        {errors?.detail ? <small>{errors.detail}</small> : null}
      </div>

      <div className={styles.field}>
        <label htmlFor="sourceUrl">
          {suggesting ? "Link to the piece you mean" : "Where did you see that?"}
        </label>
        <small>A link to the product page lets us confirm it in seconds.</small>
        <input
          id="sourceUrl"
          name="sourceUrl"
          type="url"
          placeholder="https://www.myntra.com/..."
          aria-invalid={errors?.sourceUrl ? true : undefined}
        />
        {errors?.sourceUrl ? <small>{errors.sourceUrl}</small> : null}
      </div>

      <div className={styles.field}>
        <label htmlFor="reporterEmail">Your email, if you want a reply</label>
        <small>Optional. Used only to answer this report, then deleted.</small>
        <input
          id="reporterEmail"
          name="reporterEmail"
          type="email"
          placeholder="you@example.com"
          aria-invalid={errors?.reporterEmail ? true : undefined}
        />
        {errors?.reporterEmail ? <small>{errors.reporterEmail}</small> : null}
      </div>

      {/* Invisible to a person, irresistible to a bot. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
      />

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send the report"}
      </button>
      <p className={styles.formNote}>
        This goes straight to the person who maintains the page. Prefer email?{" "}
        <a href={`mailto:${contacts.corrections}`}>{contacts.corrections}</a>.
      </p>
    </form>
  );
}
