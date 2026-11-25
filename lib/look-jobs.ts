import { z } from "zod";

/**
 * A "look from links" job: the editor hands over the Instagram post a
 * celebrity wore something in, the link(s) to buy it, and the real photo. The
 * research runner on the editor's own computer (Claude Code, on their
 * subscription) picks the job up and turns it into a DRAFT outfit, which the
 * editor reviews before anything is published.
 *
 * No imports beyond zod, so the runner and the tests can load it too.
 */

export type LookJobStatus = "queued" | "running" | "drafted" | "failed" | "cancelled";

export const LOOK_JOB_STATUSES: LookJobStatus[] = ["queued", "running", "drafted", "failed", "cancelled"];

/** The real photo, already in the bucket under inbox/. */
export type LookJobPhoto = { url: string; path: string };

export type LookJob = {
  /** Random, URL-safe; also names the photo's inbox folder. */
  id: string;
  instagramUrl: string;
  buyUrls: string[];
  /** Who wore it, as the editor named them (the sheet's NAME column). */
  celebrity?: string;
  /** The celebrity's own Instagram profile, for the credit and to confirm the appearance. */
  celebrityInstagram?: string;
  /** The label's own website (the brand that made the outfit). */
  labelUrl?: string;
  /** Other links the editor found: the same piece at another shop, or a look-alike. */
  alternateUrls?: string[];
  /** Anything the editor already knows: the event, the date, a hunch. */
  note?: string;
  photo?: LookJobPhoto;
  status: LookJobStatus;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  /** Set by the runner. */
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  /** The draft outfit the runner created. */
  outfitId?: number;
  /** Where each fact came from, and what the editor still has to check. */
  findings?: {
    evidence: { claim: string; sources: string[]; confidence: "confirmed" | "likely" | "unverified" }[];
    checks: string[];
    /** Which AI tools produced it, e.g. ["claude"]. */
    by: string[];
    /** Checks the editor has confirmed, by their exact text; see `openChecks`. */
    cleared?: { check: string; by: string; at: string }[];
  };
};

/**
 * The research checks still waiting for the editor. A look made from research
 * cannot go live while any is open: Google expects a person to fact-check
 * AI-assisted pages before they are published, and these are exactly the
 * points the research could not settle.
 */
export function openChecks(job: Pick<LookJob, "findings"> | null | undefined): string[] {
  if (!job?.findings) return [];
  const done = new Set((job.findings.cleared ?? []).map((item) => item.check));
  return job.findings.checks.filter((check) => !done.has(check));
}

/** The sentence Publish answers with when checks are open, or null. */
export function reviewProblem(job: Pick<LookJob, "findings"> | null | undefined): string | null {
  const open = openChecks(job).length;
  return open ? `${open} research check${open === 1 ? " is" : "s are"} still open. Confirm each one on the preview page first` : null;
}

/** A job the runner claimed this long ago and never finished is offered again. */
export const STALE_RUNNING_MS = 45 * 60 * 1000;

/** At most this many buying links: the look's pieces, not a shopping list. */
export const MAX_BUY_URLS = 6;

/** Query parameters that only track the visit; they never change the page. */
const TRACKING = /^(utm_|fbclid$|gclid$|igsh$|igshid$|si$|mc_|_branch|ref$|ref_src$|srsltid$|_pos$|_sid$|_ss$|_psq$|_fid$)/i;

/** Drops tracking parameters and the fragment, so a link is stored as itself. */
export function cleanUrl(raw: string): string {
  const url = new URL(raw.trim());
  for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
  url.hash = "";
  return url.toString();
}

const isHttps = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password && url.hostname.includes(".");
  } catch {
    return false;
  }
};

/**
 * A post or reel on instagram.com, reduced to its canonical address:
 * https://www.instagram.com/p/<code>/ (or /reel/<code>/). Profile pages,
 * stories and other hosts are refused: the runner needs one specific post.
 */
export function instagramPostUrl(raw: string): string | null {
  if (!isHttps(raw)) return null;
  const url = new URL(raw.trim());
  if (!/^(www\.)?instagram\.com$/i.test(url.hostname)) return null;
  const match = url.pathname.match(/^\/(?:[A-Za-z0-9._]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,64})\/?$/);
  if (!match) return null;
  const kind = match[1] === "reels" ? "reel" : match[1];
  return `https://www.instagram.com/${kind}/${match[2]}/`;
}

/** Splits the buying-links box: one per line (commas and spaces tolerated). */
/** At most this many alternate links per look. */
export const MAX_ALTERNATE_URLS = 3;

/** A celebrity's Instagram profile (not a post), normalised; null when it is not one. */
export function instagramProfileUrl(raw: string): string | null {
  if (!isHttps(raw)) return null;
  const url = new URL(raw.trim());
  if (!/^(www\.)?instagram\.com$/i.test(url.hostname)) return null;
  const match = url.pathname.match(/^\/([A-Za-z0-9._]{1,30})\/?$/);
  if (!match || ["p", "reel", "reels", "tv", "explore", "stories", "accounts"].includes(match[1].toLowerCase())) return null;
  return `https://www.instagram.com/${match[1]}/`;
}

/** The label's site: an https address, tracking tags removed. */
const labelSite = (raw: string) => cleanUrl(raw);

/**
 * One row copied from the editor's Google Sheet (cells separated by tabs), sorted
 * into the form's fields by what each cell is rather than by column position, so
 * a moved or added column does not put a link in the wrong box:
 *   an Instagram post → the post; an Instagram profile → the celebrity's Instagram;
 *   a site's home page → the label's website; other links → the original first,
 *   then alternates; the first plain text → the celebrity. Status words are ignored.
 */
export function parseSheetRow(row: string): {
  celebrity: string;
  celebrityInstagram: string;
  labelUrl: string;
  buyUrls: string;
  instagramUrl: string;
  alternateUrls: string;
} {
  const out = { celebrity: "", celebrityInstagram: "", labelUrl: "", buyUrls: "", instagramUrl: "", alternateUrls: "" };
  const products: string[] = [];
  const cells = row.split(/\t|\r?\n/).map((cell) => cell.trim()).filter(Boolean);
  for (const cell of cells) {
    const urls = cell.split(/\s+/).filter((part) => /^https?:\/\//i.test(part));
    if (!urls.length) {
      if (!out.celebrity && !/^(pending|done|published|drafted|draft|queued|skip|skipped|in progress|researching)$/i.test(cell)) out.celebrity = cell;
      continue;
    }
    for (const url of urls) {
      if (instagramPostUrl(url)) {
        if (!out.instagramUrl) out.instagramUrl = instagramPostUrl(url)!;
      } else if (instagramProfileUrl(url)) {
        if (!out.celebrityInstagram) out.celebrityInstagram = instagramProfileUrl(url)!;
      } else if (isHttps(url) && new URL(url).pathname.replace(/\/+$/, "") === "" && !out.labelUrl) {
        out.labelUrl = url;
      } else if (isHttps(url)) {
        products.push(url);
      }
    }
  }
  out.buyUrls = products[0] ?? "";
  out.alternateUrls = products.slice(1, 1 + MAX_ALTERNATE_URLS).join("\n");
  return out;
}

export const splitUrls = (raw: string) =>
  raw
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

/** Only paths the upload route writes for this page: inbox/<upload>/<upload>-1-<hex8>.<ext>,
 *  where <upload> is the form's own random id; under dev/ when development or a
 *  preview wrote it. */
export const INBOX_PHOTO = /^(?:dev\/)?inbox\/([a-z0-9]{12})\/\1-1-[0-9a-f]{8}\.(jpg|png|webp|avif)$/;

const FIREBASE_URL = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[a-z0-9.-]+\/o\/[^?#]+\?alt=media&token=[0-9a-f-]{36}$/;

export const newLookJobSchema = z
  .object({
    instagramUrl: z
      .string()
      .trim()
      .min(1, "Paste the Instagram post the outfit is from.")
      .refine((value) => !value || instagramPostUrl(value) !== null,"Use a link to one Instagram post or reel (instagram.com/p/… or /reel/…).")
      .transform((value) => instagramPostUrl(value) as string),
    buyUrls: z
      .string()
      .transform(splitUrls)
      .pipe(
        z
          .array(z.string().refine(isHttps, "Each buying link must be a full https:// address."))
          .min(1, "Add at least one link where the piece can be bought.")
          .max(MAX_BUY_URLS, `At most ${MAX_BUY_URLS} buying links, one per piece.`),
      )
      .transform((urls) => [...new Set(urls.map(cleanUrl))]),
    celebrity: z
      .string()
      .trim()
      .max(80, "Keep the name under 80 characters.")
      .optional()
      .transform((value) => value || undefined),
    celebrityInstagram: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || instagramProfileUrl(value) !== null, "Use the celebrity's profile link, e.g. https://www.instagram.com/handle/ (not a post).")
      .transform((value) => (value ? (instagramProfileUrl(value) as string) : undefined)),
    labelUrl: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || isHttps(value), "The label's website must be a full https:// address.")
      .transform((value) => (value ? labelSite(value) : undefined)),
    alternateUrls: z
      .string()
      .optional()
      .transform((value) => splitUrls(value ?? ""))
      .pipe(
        z
          .array(z.string().refine(isHttps, "Each alternate link must be a full https:// address."))
          .max(MAX_ALTERNATE_URLS, `At most ${MAX_ALTERNATE_URLS} alternate links.`),
      )
      .transform((urls) => {
        const unique = [...new Set(urls.map(cleanUrl))];
        return unique.length ? unique : undefined;
      }),
    note: z
      .string()
      .trim()
      .max(1000, "Keep the note under 1,000 characters.")
      .transform((value) => value || undefined),
    photoPath: z.string().trim(),
    photoUrl: z.string().trim(),
  })
  .superRefine((value, ctx) => {
    if (!value.photoPath && !value.photoUrl) return;
    // The download URL must name this very file (Firebase encodes the path's
    // slashes as %2F), so a path cannot be paired with someone else's photo.
    const encoded = encodeURIComponent(value.photoPath);
    if (!INBOX_PHOTO.test(value.photoPath) || !FIREBASE_URL.test(value.photoUrl) || !value.photoUrl.includes(`/o/${encoded}?`)) {
      ctx.addIssue({ code: "custom", path: ["photo"], message: "That photo did not upload properly. Remove it and drop it in again." });
    }
  })
  .transform(({ photoPath, photoUrl, ...rest }) => ({
    ...rest,
    ...(photoPath ? { photo: { path: photoPath, url: photoUrl } } : {}),
  }));

export type NewLookJob = z.output<typeof newLookJobSchema> & { id: string };

/** A fresh job or upload id: 12 lowercase letters and digits. */
export function newLookJobId(random: (bytes: number) => Uint8Array): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return [...random(12)].map((byte) => alphabet[byte % alphabet.length]).join("");
}

/** What each status means to the editor. */
export const STATUS_LABEL: Record<LookJobStatus, string> = {
  queued: "Waiting for the runner",
  running: "Researching…",
  drafted: "Draft ready to review",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** A job may be cancelled until the runner has finished with it. */
export const canCancel = (status: LookJobStatus) => status === "queued" || status === "running";
