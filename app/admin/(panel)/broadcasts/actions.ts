"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth/admin";
import { getOutfits, getSubscribers } from "@/lib/db/content";
import { cancelMailJob, queueLookAnnouncement } from "@/lib/db/mutations";
import { lookSubject } from "@/lib/mail/templates";
import { outfitSlug } from "@/lib/slugs";
import { site } from "@/lib/site-config";
import { isMailable, outfitPhoto, pricing } from "@/lib/types";

export type AnnounceState = { error?: string; queued?: string };

/**
 * Announces a look to the confirmed list.
 *
 * Two guards stand between the button and the outbox. The typed confirmation
 * makes an accidental send impossible to do absent-mindedly, and the queue
 * means even a deliberate mistake can be cancelled before most of it leaves.
 */
export async function announceOutfit(
  _previous: AnnounceState,
  form: FormData,
): Promise<AnnounceState> {
  await requireAdmin();

  const outfitId = Number(form.get("outfitId"));
  if (!Number.isFinite(outfitId)) return { error: "Pick a look to announce." };

  // Typed rather than clicked. A checkbox is something you tick past.
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "SEND") {
    return { error: 'Type SEND in the box to confirm. Nothing was sent.' };
  }

  const [outfits, subscribers] = await Promise.all([getOutfits(), getSubscribers()]);
  const outfit = outfits.find((item) => item.id === outfitId);
  if (!outfit) return { error: "That look no longer exists." };

  const audience = subscribers.filter(isMailable).length;
  if (audience === 0) {
    return { error: "Nobody has confirmed their address yet, so there is nobody to write to." };
  }

  const money = pricing(outfit);
  const slug = outfitSlug(outfit);

  const result = await queueLookAnnouncement({
    id: randomUUID(),
    outfitId: outfit.id,
    subject: lookSubject(outfit.celebrity, outfit.event),
    audience,
    look: {
      celebrity: outfit.celebrity,
      event: outfit.event,
      slug,
      // Frozen here on purpose: editing the slug afterwards must not silently
      // change where a mail already sent points.
      url: `${site.url}/outfits/${slug}`,
      image: outfitPhoto(outfit)?.url,
      pieces: money.pieces,
      worn: money.anyPriced ? money.wornTotal : undefined,
    },
  });

  if (!result.queued) {
    return { error: "That look has already been announced. One announcement per look." };
  }

  revalidatePath("/admin/broadcasts");
  return { queued: `Queued for ${audience} ${audience === 1 ? "reader" : "readers"}.` };
}

export async function stopBroadcast(form: FormData) {
  await requireAdmin();
  await cancelMailJob(String(form.get("id")));
  revalidatePath("/admin/broadcasts");
}
