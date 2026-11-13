"use server";

import { adminForAction } from "@/lib/auth/admin";
import { getAllOutfits } from "@/lib/db/content";
import { seoReviewRepo } from "@/lib/db/seo-reviews";
import { outfitSlug } from "@/lib/slugs";
import { attachPrepared, loadReview, saveReview, type LookIndex, type SaveResult } from "@/lib/seo-review/store";

/**
 * Keyword research for one look: read, save, and attach research prepared
 * under a slug. Admin only — each asks for the session first and touches
 * nothing without it (server actions are POST-only and same-origin checked by
 * Next.js). Writes only to `seoReviews`; the outfit itself is never changed
 * here, and nothing is published.
 */

const looks: LookIndex = {
  outfitExists: async (id) => (await getAllOutfits()).some((outfit) => outfit.id === id),
  slugOwner: async (slug) => (await getAllOutfits()).find((outfit) => outfitSlug(outfit) === slug)?.id ?? null,
};

export async function loadSeoReview(key: string) {
  const session = await adminForAction();
  if (!session) return { ok: false as const, error: "Your session expired.", sessionExpired: true };
  return loadReview({ session, key, repo: await seoReviewRepo() });
}

export async function saveSeoReview(payload: unknown): Promise<SaveResult> {
  const session = await adminForAction();
  if (!session) return saveReview({ session: null, payload, repo: NO_REPO, now: new Date(), looks });
  return saveReview({ session, payload, repo: await seoReviewRepo(), now: new Date(), looks });
}

export async function attachPreparedSeoReview(outfitId: unknown, slug: unknown, revision: unknown): Promise<SaveResult> {
  const session = await adminForAction();
  if (!session) return attachPrepared({ session: null, outfitId, slug, revision, repo: NO_REPO, now: new Date(), savedSlugOf: async () => null });
  return attachPrepared({
    session,
    outfitId,
    slug,
    revision,
    repo: await seoReviewRepo(),
    now: new Date(),
    savedSlugOf: async (id) => {
      const outfit = (await getAllOutfits()).find((o) => o.id === id);
      return outfit ? outfitSlug(outfit) : null;
    },
  });
}

/** Never reached: the signed-out path returns before touching a repository. */
const NO_REPO = {
  get: async () => null,
  put: async () => "conflict" as const,
  remove: async () => "conflict" as const,
};
