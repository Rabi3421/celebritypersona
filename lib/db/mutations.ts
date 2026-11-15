import "server-only";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { revalidatePublicSite } from "@/lib/revalidation";
import { deleteObject, ref } from "firebase/storage";
import { firebaseStorage } from "@/lib/firebase";
import { getDb, getMongoClient } from "@/lib/mongodb";
import { persistOutfit, type OutfitCommit } from "@/lib/db/catalog-outfits";
import { persistHubCreate, persistHubEdit, persistHubRename, hubWrite } from "@/lib/db/catalog-hubs";
import { catalogTransaction } from "@/lib/db/catalog-transaction";
import type { ImportProvenance } from "@/lib/outfit-research";
import { storageDeleteAllowed } from "@/lib/db-guard";
import { ARCHIVE_HUBS, pingIndexNow } from "@/lib/indexnow";
import { hasSwap, hasWornPrice, isPublished, MAILABLE, outfitOccasions, outfitPhotos } from "@/lib/types";
import { budgetBucket, budgetSlug } from "@/lib/budget";
import type { InstagramReel } from "@/lib/instagram";
import { nameSlug, outfitSlug } from "@/lib/slugs";
import type {
  BudgetPage,
  Brand,
  Celebrity,
  MailDelivery,
  MailJob,
  MailJobStatus,
  OptInRecord,
  CelebrityRequest,
  HomeContent,
  LinkClick,
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
 *
 * The same call tells IndexNow, so Bing and Copilot learn about a change when
 * it happens rather than on their own schedule. `touched` names the specific
 * pages this write created or altered, when the caller knows them; the hubs
 * are always included because every published record moves the counts and the
 * "latest decoded" rails.
 *
 * The ping is not awaited. Revalidation is what the editor is waiting on, and
 * a search engine's availability is not allowed to hold up a save — or to fail
 * one, which is why `pingIndexNow` swallows its own errors and this adds a
 * second catch for the rejection an unawaited promise would otherwise leave
 * unhandled.
 */
function revalidateSite(touched: string[] = []) {
  // The layout alone missed the sitemap, llms.txt and the search index.
  revalidatePublicSite();
  void pingIndexNow([...ARCHIVE_HUBS, ...touched]).catch(() => {});
}

/** Totals are always the sum of the pieces, never typed in by hand. */
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
  // Development shares the production bucket and may only delete its own
  // dev/ uploads; see lib/db-guard.ts.
  paths = paths.filter((path) => path && storageDeleteAllowed(path));
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

/** A brand page's intro and search fields. The record itself is created when
 *  a look first names the label. */
export async function updateBrand(id: number, input: Omit<Brand, "id" | "name">) {
  const db = await getDb();
  await db.collection<Brand>("brands").updateOne({ id }, hubWrite(input));
  revalidateSite();
}

/** One budget page's intro and search fields, created on first save. */
export async function saveBudgetPage(cap: number, input: Omit<BudgetPage, "cap">) {
  const db = await getDb();
  const write = hubWrite(input);
  await db.collection<BudgetPage>("budgetPages").updateOne(
    { cap },
    { ...write, $set: { ...write.$set, cap } },
    { upsert: true },
  );
  revalidateSite();
}

/* ---------------------------------------------------------------- outfits */

/**
 * Creates a record for any celebrity or occasion this look names that has
 * none, so every name the archive uses has a document to hold an intro and
 * its search fields. The virtual rows in `celebrityViews`/`occasionViews`
 * stay as a safety net for data written outside the panel.
 */
export async function createOutfit(input: Omit<Outfit, "id" | "worn" | "swap">, options: { actor: string; requestKey: string; provenance?: ImportProvenance; approvedRelated?: string }) {
  const common = { client: await getMongoClient(), db: await getDb(), input, actor: options.actor,
    afterCommit: ({ next }: OutfitCommit) => {
      if (options.provenance) revalidatePath("/admin/outfits");
      else revalidateSite(isPublished(next) ? outfitTouched(next) : []);
    },
  };
  return options.provenance
    ? persistOutfit({ ...common, mode: "import", provenance: options.provenance, approvedRelated: options.approvedRelated ?? "" })
    : persistOutfit({ ...common, mode: "create", requestKey: options.requestKey });
}
/** The public pages a single look owns or appears on, for IndexNow. Her
 *  archive and the occasion archive both gain a card, so both changed. */
function outfitTouched(outfit: Outfit): string[] {
  return [
    `/outfits/${outfitSlug(outfit)}`,
    `/celebrities/${nameSlug(outfit.celebrity)}`,
    // Every occasion page it appears on, not only the primary.
    ...outfitOccasions(outfit).map((name) => `/occasions/${nameSlug(name)}`),
    // Every label it names, and the budget page it sits on.
    ...[...new Set(outfit.items.flatMap((item) => [item.wornBrand, item.swapBrand]).filter(Boolean))].map(
      (name) => `/brands/${nameSlug(name as string)}`,
    ),
    ...(budgetBucket(outfit) ? [`/budget/${budgetSlug(budgetBucket(outfit)!)}`] : []),
  ];
}

/**
 * Remembers that a URL moved.
 *
 * Renaming a look's event, or a celebrity, rewrites the slug it is served at —
 * and the old one is what every existing link, share and search result still
 * points at. Kept in a collection of its own so a name no record covers can be
 * redirected too; consulted only when a slug matches nothing live, so a name
 * reused later still wins.
 */
export async function updateOutfit(id: number, input: Omit<Outfit, "id" | "worn" | "swap">, options: { actor: string; expectedVersion: string; slugUnlocked?: boolean }) {
  return persistOutfit({ client: await getMongoClient(), db: await getDb(), input, mode: "edit", id, ...options,
    afterCommit: async ({ previous, next }) => {
      const kept = new Set(outfitPhotos(next).map((image) => image.path));
      await forgetImages(previous ? outfitPhotos(previous).map((image) => image.path).filter((path) => !kept.has(path)) : []);
      revalidateSite([
        ...(previous && isPublished(previous) ? outfitTouched(previous) : []),
        ...(isPublished(next) ? outfitTouched(next) : []),
      ]);
    },
  });
}
export async function deleteOutfit(id: number) {
  const db = await getDb();
  const doomed = await catalogTransaction(await getMongoClient(), db, async (session) => {
    const collection = db.collection<Outfit>("outfits");
    const previous = await collection.findOne({ id }, { session });
    await collection.deleteOne({ id }, { session });
    return previous;
  });
  await forgetImages(doomed ? outfitPhotos(doomed).map((image) => image.path) : []);
  revalidateSite();
}
/* ------------------------------------------------------------ celebrities */

export async function createCelebrity(input: Omit<Celebrity, "id">) {
  const id = await persistHubCreate({ client: await getMongoClient(), db: await getDb(), collection: "celebrities", input });
  revalidateSite();
  return id;
}
export async function updateCelebrity(id: number, input: Omit<Celebrity, "id">) {
  await persistHubEdit({ client: await getMongoClient(), db: await getDb(), collection: "celebrities", id, input });
  revalidateSite();
}
export async function renameCelebrityEverywhere(from: string, to: string) {
  const result = await persistHubRename({ client: await getMongoClient(), db: await getDb(), collection: "celebrities", from, to });
  revalidateSite();
  return result;
}
export async function renameOccasionEverywhere(from: string, to: string) {
  const result = await persistHubRename({ client: await getMongoClient(), db: await getDb(), collection: "occasions", from, to });
  revalidateSite();
  return result;
}
export async function deleteCelebrity(id: number) {
  const db = await getDb();
  await catalogTransaction(await getMongoClient(), db, async (session) => { await db.collection<Celebrity>("celebrities").deleteOne({ id }, { session }); });
  revalidateSite();
}

/* -------------------------------------------------------------- occasions */

export async function createOccasion(input: Omit<Occasion, "id">) {
  const id = await persistHubCreate({ client: await getMongoClient(), db: await getDb(), collection: "occasions", input });
  revalidateSite();
  return id;
}
export async function updateOccasion(id: number, input: Omit<Occasion, "id">) {
  await persistHubEdit({ client: await getMongoClient(), db: await getDb(), collection: "occasions", id, input });
  revalidateSite();
}
export async function deleteOccasion(id: number) {
  const db = await getDb();
  await catalogTransaction(await getMongoClient(), db, async (session) => { await db.collection<Occasion>("occasions").deleteOne({ id }, { session }); });
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

/* ------------------------------------------------------------- link clicks */

/**
 * Counts one outbound click.
 *
 * Never throws at the caller. A click is a redirect the reader is waiting on,
 * and losing a row from an analytics table is not a reason to make somebody
 * stare at an error instead of arriving at the shop. The insert is not
 * awaited for correctness, only for ordering.
 *
 * No page is revalidated: the admin revenue screen reads these fresh, and
 * nothing public renders them.
 */
export async function recordLinkClick(click: Omit<LinkClick, "id">) {
  try {
    const db = await getDb();
    await db.collection<LinkClick>("linkClicks").insertOne({ ...click, id: randomUUID() });
  } catch (error) {
    console.error("Link click was not recorded", error instanceof Error ? error.name : "Unknown");
  }
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

/**
 * Replaces the mirrored reel list wholesale.
 *
 * Written by `npm run instagram:mirror`, never by the panel: it is a snapshot
 * of the account, not editorial copy, and an editor typing into it would be
 * describing reels rather than reporting them.
 */
export async function saveMirroredReels(value: InstagramReel[]) {
  const db = await getDb();
  await db
    .collection("siteContent")
    .updateOne({ key: "reels" }, { $set: { key: "reels", value } }, { upsert: true });
  revalidateSite();
}

export async function saveHomeContent(value: HomeContent) {
  const db = await getDb();
  await db
    .collection("siteContent")
    .updateOne({ key: "home" }, { $set: { key: "home", value } }, { upsert: true });
  revalidateSite();
}
