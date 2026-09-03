"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth/admin";
import { getOutfits, getSubscribers } from "@/lib/db/content";
import { cancelMailJob, queueLookAnnouncement } from "@/lib/db/mutations";
import { drainQueue } from "@/lib/mail/drain";
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

  /**
   * Send it now, after this response has gone back to the browser.
   *
   * The queue is still what holds the truth — every attempt is recorded, and a
   * list too long to finish here is picked up by the scheduled run. What this
   * buys is the obvious thing: press the button and the mail leaves, rather
   * than waiting on a timer for something already decided.
   *
   * It runs after the response, so a slow provider cannot hold the panel open,
   * and a failure here cannot lose the announcement: it is already queued.
   */
  after(async () => {
    try {
      // Shorter than the scheduled run's budget — this is a background task on
      // a request that has already been answered.
      await drainQueue(25_000);
    } catch (error) {
      console.error("Announcement send failed; the scheduled run will retry", error);
    }
  });

  revalidatePath("/admin/broadcasts");
  return {
    queued: `Sending to ${audience} ${audience === 1 ? "reader" : "readers"} now.`,
  };
}

export async function stopBroadcast(form: FormData) {
  await requireAdmin();
  await cancelMailJob(String(form.get("id")));
  revalidatePath("/admin/broadcasts");
}
