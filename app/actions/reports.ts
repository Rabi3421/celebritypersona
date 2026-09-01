"use server";

import { headers } from "next/headers";
import { checkRateLimit, clientKey, recordFailure } from "@/lib/auth/rate-limit";
import { getOutfits } from "@/lib/db/content";
import { createPriceReport } from "@/lib/db/mutations";
import { text } from "@/lib/form-data";
import { outfitSlug } from "@/lib/slugs";
import { fieldErrors, priceReportSchema, type FieldErrors } from "@/lib/validation";

/**
 * The public "something is wrong" / "I know a better swap" form.
 *
 * It used to hand the reader a mailto: link, which meant every report depended
 * on them having a mail client set up and on somebody reading that inbox.
 * Reports now go straight to the collection the panel shows.
 */

export type ReportState = {
  errors?: FieldErrors;
  /** Set once a report has been stored, so the form can thank them. */
  sent?: boolean;
};

/** A handful an hour is a generous reader and an obvious flood. */
const REPORT_LIMIT = { windowMs: 60 * 60 * 1000, max: 8 };

export async function submitPriceReport(
  _previous: ReportState,
  form: FormData,
): Promise<ReportState> {
  const key = await clientKey(await headers());
  const limit = checkRateLimit(`report:${key}`, REPORT_LIMIT);
  if (!limit.ok) {
    return {
      errors: {
        form: `That is a lot of reports at once. Try again in ${limit.retryAfterMinutes} minute${
          limit.retryAfterMinutes === 1 ? "" : "s"
        }.`,
      },
    };
  }

  const parsed = priceReportSchema.safeParse({
    outfitSlug: text(form, "outfitSlug"),
    issue: text(form, "issue"),
    piece: text(form, "piece"),
    detail: text(form, "detail"),
    sourceUrl: text(form, "sourceUrl"),
    reporterEmail: text(form, "reporterEmail"),
    website: text(form, "website"),
  });

  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    // The honeypot is invisible, so a failure there is a bot. Say nothing
    // useful and do not spend a database write on it.
    if (errors.website) return { sent: true };
    return { errors };
  }

  // Every submission counts towards the limit, not only the malformed ones.
  recordFailure(`report:${key}`, REPORT_LIMIT);

  // The honeypot has done its job by validating; it is never stored.
  const report = parsed.data;

  // A reader can paste a full URL. Store the slug the panel can look up, and
  // only when it actually names a look we hold.
  const slug = normaliseSlug(report.outfitSlug);
  const known = slug ? (await getOutfits()).some((outfit) => outfitSlug(outfit) === slug) : false;

  await createPriceReport({
    issue: report.issue,
    piece: report.piece,
    sourceUrl: report.sourceUrl,
    reporterEmail: report.reporterEmail,
    outfitSlug: known ? slug : "",
    // Keep what they typed when it did not resolve, so the report is still
    // actionable rather than silently losing the only clue it had.
    detail: known || !report.outfitSlug ? report.detail : `Page given: ${report.outfitSlug}\n\n${report.detail}`,
  });

  return { sent: true };
}

/** Accepts a slug, a path or a full URL and returns the slug. */
function normaliseSlug(value: string | undefined) {
  if (!value) return "";
  const withoutQuery = value.split(/[?#]/)[0];
  const segments = withoutQuery.split("/").filter(Boolean);
  return (segments[segments.length - 1] ?? "").toLowerCase();
}
