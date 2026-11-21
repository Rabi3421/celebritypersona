import { z } from "zod";

/**
 * A "look from links" job: the editor hands over the Instagram post a
 * celebrity wore something in, the link(s) to buy it, and the real photo. The
 * research runner on the editor's own computer (Claude Code + Codex, on their
 * subscriptions) picks the job up and turns it into a DRAFT outfit, which the
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
  };
};

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
export const splitUrls = (raw: string) =>
  raw
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

/** Only paths the upload route writes for this page: inbox/<job>/<job>-1-<hex8>.<ext>,
 *  under dev/ when development or a preview wrote it. */
export const INBOX_PHOTO = /^(?:dev\/)?inbox\/([a-z0-9]{12})\/\1-1-[0-9a-f]{8}\.(jpg|png|webp|avif)$/;

const FIREBASE_URL = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[a-z0-9.-]+\/o\/[^?#]+\?alt=media&token=[0-9a-f-]{36}$/;

export const newLookJobSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]{12}$/, "Reload the page and try again."),
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
    const match = value.photoPath.match(INBOX_PHOTO);
    if (!match || match[1] !== value.id || !FIREBASE_URL.test(value.photoUrl)) {
      ctx.addIssue({ code: "custom", path: ["photo"], message: "That photo did not upload properly. Remove it and drop it in again." });
    }
  })
  .transform(({ photoPath, photoUrl, ...rest }) => ({
    ...rest,
    ...(photoPath ? { photo: { path: photoPath, url: photoUrl } } : {}),
  }));

export type NewLookJob = z.output<typeof newLookJobSchema>;

/** A fresh job id: 12 lowercase letters and digits. */
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
