import "server-only";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { deleteObject, ref } from "firebase/storage";
import { firebaseStorage } from "@/lib/firebase";
import { getDb } from "@/lib/mongodb";
import { hasSwap, hasWornPrice, MAILABLE, outfitPhotos } from "@/lib/types";
import type {
  Celebrity,
  MailDelivery,
  MailJob,
  MailJobStatus,
  OptInRecord,
  CelebrityRequest,
  HomeContent,
  Occasion,
  Outfit,
  OutfitItem,
  PriceReport,
  RequestStatus,
  Subscriber,
  SubscriberStatus,
  TrendingSearch,
} from "@/lib/types";

/**
 * Every write the panel makes.
 *
 * Public pages are prerendered, so each mutation revalidates the site. That is
 * deliberately broad: this archive is small, and a stale price is a worse
 * outcome than an extra render.
 */
function revalidateSite() {
  revalidatePath("/", "layout");
}

/** Totals are always the sum of the pieces, never typed in by hand. A piece
 *  with no swap yet contributes to the worn total but not the swap total. */
/** The day an editor last had these prices in front of them. The detail page
 *  used to claim "re-checked 2 days ago" on every look, forever. */
const today = () => new Date().toISOString().slice(0, 10);

export const outfitTotals = (items: OutfitItem[]) => ({
  worn: items.filter(hasWornPrice).reduce((sum, item) => sum + (item.worn ?? 0), 0),
  swap: items.filter(hasSwap).reduce((sum, item) => sum + item.swap, 0),
});

/**
 * Removes stored photos once nothing points at them. Failures are swallowed on
 * purpose: an orphaned file is untidy, but a failed delete must never stop the
 * content change the editor actually asked for.
 */
async function forgetImages(paths: (string | undefined)[]) {
  await Promise.all(
    paths.filter(Boolean).map(async (path) => {
      try {
        await deleteObject(ref(firebaseStorage(), path as string));
      } catch {
        // Already gone, or the rules do not allow deletes. Nothing to do.
      }
    }),
  );
}

async function nextId(collection: string) {
  const db = await getDb();
  const [highest] = await db
    .collection(collection)
    .find({}, { projection: { id: 1 }, sort: { id: -1 }, limit: 1 })
    .toArray();
  return ((highest?.id as number) ?? 0) + 1;
}

/* ---------------------------------------------------------------- outfits */

export async function createOutfit(input: Omit<Outfit, "id" | "worn" | "swap">) {
  const db = await getDb();
  const id = await nextId("outfits");
  await db.collection<Outfit>("outfits").insertOne({
    ...input,
    ...outfitTotals(input.items),
    pricesCheckedAt: today(),
    id,
  });
  revalidateSite();
  return id;
}

export async function updateOutfit(
  id: number,
  input: Omit<Outfit, "id" | "worn" | "swap">,
) {
  const db = await getDb();
  const collection = db.collection<Outfit>("outfits");
  const previous = await collection.findOne(
    { id },
    { projection: { image: 1, images: 1 } },
  );

  // `image` is the single-photo field older documents were saved with. Always
  // clearing it keeps one look from carrying two competing photo fields. The
  // search overrides are cleared the same way: a field the editor emptied has
  // to leave the document, or the page would keep serving the old title.
  await collection.updateOne(
    { id },
    {
      $set: {
        ...input,
        images: input.images ?? [],
        ...outfitTotals(input.items),
        pricesCheckedAt: today(),
      },
      $unset: {
        image: "",
        ...(input.seoTitle ? {} : { seoTitle: "" }),
        ...(input.seoDescription ? {} : { seoDescription: "" }),
      },
    },
  );

  // Photos dropped from the look have no owner left.
  const kept = new Set((input.images ?? []).map((image) => image.path));
  await forgetImages(
    previous
      ? outfitPhotos(previous).map((image) => image.path).filter((path) => !kept.has(path))
      : [],
  );

  revalidateSite();
}

export async function deleteOutfit(id: number) {
  const db = await getDb();
  const collection = db.collection<Outfit>("outfits");
  const doomed = await collection.findOne(
    { id },
    { projection: { image: 1, images: 1 } },
  );
  await collection.deleteOne({ id });
  await forgetImages(doomed ? outfitPhotos(doomed).map((image) => image.path) : []);
  revalidateSite();
}

/* ------------------------------------------------------------ celebrities */

export async function createCelebrity(input: Omit<Celebrity, "id">) {
  const db = await getDb();
  const id = await nextId("celebrities");
  await db.collection<Celebrity>("celebrities").insertOne({ ...input, id });
  revalidateSite();
  return id;
}

export async function updateCelebrity(id: number, input: Omit<Celebrity, "id">) {
  const db = await getDb();
  await db.collection<Celebrity>("celebrities").updateOne({ id }, { $set: input });
  revalidateSite();
}

export async function deleteCelebrity(id: number) {
  const db = await getDb();
  await db.collection<Celebrity>("celebrities").deleteOne({ id });
  revalidateSite();
}

/* -------------------------------------------------------------- occasions */

export async function createOccasion(input: Omit<Occasion, "id">) {
  const db = await getDb();
  const id = await nextId("occasions");
  await db.collection<Occasion>("occasions").insertOne({ ...input, id });
  revalidateSite();
  return id;
}

export async function updateOccasion(id: number, input: Omit<Occasion, "id">) {
  const db = await getDb();
  await db.collection<Occasion>("occasions").updateOne({ id }, { $set: input });
  revalidateSite();
}

export async function deleteOccasion(id: number) {
  const db = await getDb();
  await db.collection<Occasion>("occasions").deleteOne({ id });
  revalidateSite();
}

/* ------------------------------------------------------- trending searches */

export async function upsertTrendingSearch(
  original: string | null,
  input: TrendingSearch,
) {
  const db = await getDb();
  await db
    .collection<TrendingSearch>("trendingSearches")
    .updateOne({ term: original ?? input.term }, { $set: input }, { upsert: true });
  revalidateSite();
}

export async function deleteTrendingSearch(term: string) {
  const db = await getDb();
  await db.collection<TrendingSearch>("trendingSearches").deleteOne({ term });
  revalidateSite();
}

/* ---------------------------------------------------------- price reports */

/**
 * A reader's report. Written straight to the collection the panel reads, so a
 * correction lands in the inbox rather than in an email nobody triages. The id
 * is generated here so the action never has to trust the client for one.
 */
export async function createPriceReport(
  input: Omit<PriceReport, "id" | "receivedAt" | "status">,
) {
  const db = await getDb();
  // The driver writes an absent optional as null, which then reads back as a
  // value the type says cannot be there. Drop them instead.
  const given = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== ""),
  ) as typeof input;
  const report: PriceReport = {
    ...given,
    id: randomUUID(),
    receivedAt: new Date().toISOString(),
    status: "New",
  };
  await db.collection<PriceReport>("priceReports").insertOne(report);
  // Only the panel changes; no public page renders reports.
  revalidatePath("/admin/reports");
  return report.id;
}

export async function setPriceReportStatus(
  id: string,
  status: PriceReport["status"],
  note?: string,
) {
  const db = await getDb();
  await db
    .collection<PriceReport>("priceReports")
    .updateOne(
      { id },
      note === undefined ? { $set: { status } } : { $set: { status, note } },
    );
  revalidatePath("/admin/reports");
}

export async function deletePriceReport(id: string) {
  const db = await getDb();
  await db.collection<PriceReport>("priceReports").deleteOne({ id });
  revalidatePath("/admin/reports");
}

/* ------------------------------------------------- requests & subscribers */

/**
 * Asking for someone already in the queue adds a vote instead of a row, so the
 * panel can rank by demand — which is what the public page promises.
 */
export async function recordCelebrityRequest(name: string) {
  const db = await getDb();
  const now = new Date().toISOString();
  // Matched case-insensitively on the whole string; "alia bhatt" and "Alia
  // Bhatt" are one request, not two.
  const key = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  await db.collection<CelebrityRequest>("celebrityRequests").updateOne(
    { name: key },
    {
      $inc: { votes: 1 },
      $set: { lastAskedAt: now },
      $setOnInsert: { id: randomUUID(), name, firstAskedAt: now, status: "New" },
    },
    { upsert: true },
  );
  revalidatePath("/admin/requests");
}

export async function setCelebrityRequestStatus(id: string, status: RequestStatus) {
  const db = await getDb();
  await db.collection<CelebrityRequest>("celebrityRequests").updateOne({ id }, { $set: { status } });
  revalidatePath("/admin/requests");
}

export async function deleteCelebrityRequest(id: string) {
  const db = await getDb();
  await db.collection<CelebrityRequest>("celebrityRequests").deleteOne({ id });
  revalidatePath("/admin/requests");
}

/**
 * Signing up twice is not two people. The number is the key, and re-subscribing
 * after unsubscribing simply makes them active again.
 */
/**
 * Someone asked for the new looks. Nothing is mailed to them yet.
 *
 * The address starts `Pending` and stays there until the link is clicked,
 * because anybody can type anybody else's address into a form. Returning to an
 * address we already hold reuses the row — the email is the key — so signing
 * up five times never makes five rows, and never mails five confirmations.
 */
export async function recordSubscriber(
  email: string,
  optIn: OptInRecord,
): Promise<{ outcome: "confirm-sent" | "already-active" | "throttled"; token?: string }> {
  const db = await getDb();
  const collection = db.collection<Subscriber>("subscribers");
  const existing = await collection.findOne({ email });
  const now = new Date().toISOString();

  // Already on the list: say so, and do not send anything.
  if (existing?.status === "Active") return { outcome: "already-active" };

  // A confirmation was sent moments ago. Resending on every submit is how a
  // form becomes a way to flood somebody else's inbox.
  if (existing?.confirmSentAt && Date.now() - Date.parse(existing.confirmSentAt) < 5 * 60_000) {
    return { outcome: "throttled" };
  }

  const confirmToken = randomUUID();
  await collection.updateOne(
    { email },
    {
      $set: {
        status: "Pending",
        confirmToken,
        confirmSentAt: now,
        optIn,
      },
      $setOnInsert: {
        id: randomUUID(),
        email,
        joinedAt: now,
        // Minted once and never rotated: it has to keep working from a mail
        // sent a year ago.
        unsubscribeToken: randomUUID(),
      },
      // A previous ending no longer applies to an address asking again.
      $unset: { unsubscribedAt: "", stoppedReason: "", confirmedAt: "" },
    },
    { upsert: true },
  );

  revalidatePath("/admin/subscribers");
  return { outcome: "confirm-sent", token: confirmToken };
}

/** How long a confirmation link stays good. Long enough for a mail read the
 *  next evening, short enough that a leaked link is worthless. */
const CONFIRM_WINDOW_MS = 48 * 60 * 60 * 1000;

export type ConfirmResult = "confirmed" | "already" | "expired" | "unknown";

/**
 * The click that turns an address into a subscriber. Idempotent: a mail client
 * that prefetches the link, or a reader who taps it twice, must not see an
 * error the second time.
 */
export async function confirmSubscriber(token: string): Promise<ConfirmResult> {
  const db = await getDb();
  const collection = db.collection<Subscriber>("subscribers");
  const subscriber = await collection.findOne({ confirmToken: token });

  if (!subscriber) {
    // Either never existed, or was confirmed already and the token cleared.
    return "unknown";
  }
  if (subscriber.status === "Active") return "already";
  if (
    subscriber.confirmSentAt &&
    Date.now() - Date.parse(subscriber.confirmSentAt) > CONFIRM_WINDOW_MS
  ) {
    return "expired";
  }

  await collection.updateOne(
    { email: subscriber.email },
    {
      // The token is left in place rather than spent. Mail clients prefetch
      // links to scan them, so the first "click" is often a machine — and the
      // human who clicks a moment later must not be told their link is dead.
      // Status is what confirms; a second click simply finds it already done.
      $set: { status: "Active", confirmedAt: new Date().toISOString() },
    },
  );
  revalidatePath("/admin/subscribers");
  return "confirmed";
}

/**
 * Leaving. Deliberately forgiving: an unknown token still reports success,
 * because the alternative is telling a stranger whether an address is on the
 * list, and because a reader who wants out should never meet an error.
 */
export async function unsubscribeByToken(token: string, reason = "Asked to stop") {
  const db = await getDb();
  await db.collection<Subscriber>("subscribers").updateOne(
    { unsubscribeToken: token },
    {
      $set: {
        status: "Unsubscribed",
        unsubscribedAt: new Date().toISOString(),
        stoppedReason: reason,
      },
      $unset: { confirmToken: "" },
    },
  );
  revalidatePath("/admin/subscribers");
}

/**
 * The mailbox refused us, or the reader pressed "spam". Both are terminal.
 * Continuing to write to either is precisely what ruins a sending reputation,
 * so the address is closed rather than retried.
 */
export async function stopSubscriber(
  email: string,
  status: "Bounced" | "Complained",
  detail: string,
) {
  const db = await getDb();
  await db.collection<Subscriber>("subscribers").updateOne(
    { email },
    { $set: { status, stoppedReason: detail, unsubscribedAt: new Date().toISOString() } },
  );
  revalidatePath("/admin/subscribers");
}

export async function setSubscriberStatus(id: string, status: SubscriberStatus) {
  const db = await getDb();
  await db.collection<Subscriber>("subscribers").updateOne({ id }, { $set: { status } });
  revalidatePath("/admin/subscribers");
}

export async function deleteSubscriber(id: string) {
  const db = await getDb();
  await db.collection<Subscriber>("subscribers").deleteOne({ id });
  revalidatePath("/admin/subscribers");
}

/* --------------------------------------------------------------- the post */

/**
 * Announcing a look is a separate act from publishing it.
 *
 * Publishing writes a row and stops. Announcing copies the look into a job and
 * stops. A cron drains the job in batches. Nothing sends inside an admin
 * request, which is what makes a mistake recoverable: between pressing the
 * button and the first mail leaving there is a queue that can be cancelled.
 */
export async function queueLookAnnouncement(job: Omit<MailJob, "sent" | "failed" | "status" | "createdAt">) {
  const db = await getDb();
  const jobs = db.collection<MailJob>("mailJobs");

  // One job per look. A double-click, or a retried form post, must not make a
  // second announcement of the same thing.
  const existing = await jobs.findOne({ outfitId: job.outfitId });
  if (existing) return { queued: false as const, reason: "already" as const, job: existing };

  const record: MailJob = {
    ...job,
    status: "Queued",
    createdAt: new Date().toISOString(),
    sent: 0,
    failed: 0,
  };
  await jobs.insertOne(record);
  revalidatePath("/admin/broadcasts");
  return { queued: true as const, job: record };
}

/** Stops a job that has not finished. Anything already delivered is gone —
 *  this only prevents the rest. */
export async function cancelMailJob(id: string) {
  const db = await getDb();
  await db.collection<MailJob>("mailJobs").updateOne(
    { id, status: { $in: ["Queued", "Sending"] } },
    { $set: { status: "Cancelled", finishedAt: new Date().toISOString() } },
  );
  revalidatePath("/admin/broadcasts");
}

/** The next job waiting for the sender, oldest first. */
export async function claimMailJob(): Promise<MailJob | null> {
  const db = await getDb();
  return db.collection<MailJob>("mailJobs").findOne(
    { status: { $in: ["Queued", "Sending"] } },
    { projection: { _id: 0 }, sort: { createdAt: 1 } },
  );
}

/**
 * Who this job has not written to yet.
 *
 * Status is re-read here rather than frozen when the job was made, so an
 * address that unsubscribed, bounced or complained in the meantime is dropped
 * even mid-send. The delivery ledger supplies the rest: anyone already written
 * to is excluded, which is what makes a re-run of a half-finished batch safe.
 */
export async function nextRecipients(jobId: string, limit: number): Promise<string[]> {
  const db = await getDb();
  const done = await db
    .collection<MailDelivery>("mailDeliveries")
    .find({ jobId }, { projection: { email: 1, _id: 0 } })
    .toArray();
  const seen = new Set(done.map((row) => row.email));

  const active = await db
    .collection<Subscriber>("subscribers")
    // An address is required, not merely a status. Rows carried over from the
    // WhatsApp list are Active and have no email; without this they would
    // arrive here as `undefined` and be handed to the mail server.
    .find(
      { status: { $in: [...MAILABLE] }, email: { $type: "string", $ne: "" } },
      { projection: { email: 1, _id: 0 } },
    )
    .toArray();

  return active
    .map((row) => row.email)
    .filter((email) => !seen.has(email))
    .slice(0, limit);
}

/** Writes one attempt to the ledger. The unique index on (jobId, email) is
 *  what makes a retry harmless. */
export async function recordDelivery(delivery: MailDelivery) {
  const db = await getDb();
  const deliveries = db.collection<MailDelivery>("mailDeliveries");
  await deliveries.createIndex({ jobId: 1, email: 1 }, { unique: true }).catch(() => {});
  await deliveries.updateOne(
    { jobId: delivery.jobId, email: delivery.email },
    { $setOnInsert: delivery },
    { upsert: true },
  );
  const db2 = await getDb();
  await db2.collection<MailJob>("mailJobs").updateOne(
    { id: delivery.jobId },
    {
      $inc: delivery.status === "Sent" ? { sent: 1 } : { failed: 1 },
      $set: { status: "Sending", startedAt: delivery.at },
    },
  );
  if (delivery.status === "Sent") {
    await db2
      .collection<Subscriber>("subscribers")
      .updateOne({ email: delivery.email }, { $set: { lastSentAt: delivery.at } });
  }
}

/** No recipients left, or the sender gave up. */
export async function finishMailJob(id: string, status: MailJobStatus, error?: string) {
  const db = await getDb();
  await db.collection<MailJob>("mailJobs").updateOne(
    { id },
    {
      $set: {
        status,
        finishedAt: new Date().toISOString(),
        ...(error ? { error } : {}),
      },
    },
  );
  revalidatePath("/admin/broadcasts");
}

/* ------------------------------------------------------------ home content */

export async function saveHomeContent(value: HomeContent) {
  const db = await getDb();
  await db
    .collection("siteContent")
    .updateOne({ key: "home" }, { $set: { key: "home", value } }, { upsert: true });
  revalidateSite();
}
