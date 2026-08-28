"use client";

import { useState, type FormEvent } from "react";
import { contacts } from "@/lib/site-config";
import styles from "./editorial.module.css";

const issues = [
  { value: "Price is wrong", hint: "The number does not match the shop" },
  { value: "Link is dead", hint: "It 404s or goes to the wrong product" },
  { value: "Sold out", hint: "Listed as available but it is gone" },
  { value: "Wrong brand or piece", hint: "We identified it incorrectly" },
];

/**
 * Composes the report as an email and hands it to the visitor's mail client.
 * There is no backend yet, and pretending otherwise would silently drop
 * reports. Swap this for a server action once an endpoint exists.
 */
export function ReportPriceForm() {
  const [issue, setIssue] = useState(issues[0].value);
  const [sent, setSent] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = [
      `Issue: ${issue}`,
      `Page: ${data.get("page") || "not given"}`,
      `What it should say: ${data.get("correct") || "not given"}`,
      `Where you saw it: ${data.get("source") || "not given"}`,
      `Reply to: ${data.get("email") || "no reply wanted"}`,
    ].join("\n");

    window.location.href = `mailto:${contacts.corrections}?subject=${encodeURIComponent(
      `Price report: ${issue}`,
    )}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.field}>
        <label htmlFor="page">Which page?</label>
        <small>Paste the address of the outfit page, or describe the look.</small>
        <input
          id="page"
          name="page"
          required
          placeholder="celebritypersona.com/outfits/..."
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="issue-0">What is wrong?</label>
        <div className={styles.choices}>
          {issues.map((option, index) => (
            <label className={styles.choice} key={option.value}>
              <input
                type="radio"
                name="issue"
                id={`issue-${index}`}
                value={option.value}
                checked={issue === option.value}
                onChange={() => setIssue(option.value)}
              />
              <span>
                <strong>{option.value}</strong>
                <br />
                {option.hint}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="correct">What should it say?</label>
        <small>
          If it is a price, the figure you can see right now. If it is a piece,
          the brand you think it actually is.
        </small>
        <input id="correct" name="correct" placeholder="₹1,499 on Myntra" />
      </div>

      <div className={styles.field}>
        <label htmlFor="source">Where did you see that?</label>
        <small>A link to the retailer page helps us confirm it in seconds.</small>
        <input id="source" name="source" placeholder="Link to the product page" />
      </div>

      <div className={styles.field}>
        <label htmlFor="email">Your email, if you want a reply</label>
        <small>Optional. Used only to answer this report, then deleted.</small>
        <input id="email" name="email" type="email" placeholder="you@example.com" />
      </div>

      <button className={styles.submit} type="submit">
        Send the report
      </button>
      <p className={styles.formNote}>
        {sent
          ? `Your email app should have opened with the report ready to send. If nothing happened, email ${contacts.corrections} directly.`
          : `This opens your email app with the report filled in, so you can see exactly what you are sending. Nothing is submitted from this page.`}
      </p>
    </form>
  );
}
