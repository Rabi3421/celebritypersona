import "server-only";
import { cache } from "react";
import { getDb } from "@/lib/mongodb";
import { celebrityViews, completeLooks, occasionViews } from "@/lib/archive";
import { inr, plural } from "@/lib/format";
import { MIN_LOOKS_FOR_UNDER_5K, UNDER_5K } from "@/lib/thresholds";
import { pricing } from "@/lib/types";
import { TRENDING_METHOD_ANSWER } from "@/lib/trending";
import { trendingAnswerer } from "@/lib/trending-answers";
import type { InstagramReel } from "@/lib/instagram";
import { celebritySlug, occasionSlug, outfitSlug } from "@/lib/slugs";
import type {
  Celebrity,
  CelebrityRequest,
  HomeContent,
  MailJob,
  Occasion,
  Outfit,
  PriceReport,
  SlugRedirect,
  Subscriber,
  TrendingSearch,
} from "@/lib/types";

/** A leaderboard row as the public site publishes it. */
export type TrendingRow = TrendingSearch & { decoded: boolean };

/**
 * Every read the site makes. `cache()` dedupes within a single render, so a
 * page whose layout, header and body all want the outfit list still issues one
 * query. Public pages are prerendered, so in production these run at build.
 *
 * `_id` is always projected away: the documents cross into client components,
 * where an ObjectId would not serialise.
 */

const NO_ID = { projection: { _id: 0 } } as const;

export const getOutfits = cache(async (): Promise<Outfit[]> => {
  const db = await getDb();
  return db.collection<Outfit>("outfits").find({}, NO_ID).sort({ id: 1 }).toArray();
});

export const getOutfitBySlug = cache(async (slug: string) => {
  const outfits = await getOutfits();
  return outfits.find((outfit) => outfitSlug(outfit) === slug);
});

export const getCelebrities = cache(async (): Promise<Celebrity[]> => {
  const db = await getDb();
  return db
    .collection<Celebrity>("celebrities")
    .find({}, NO_ID)
    .sort({ id: 1 })
    .toArray();
});

/**
 * Records joined to the numbers the archive computes for them. Every public
 * page reads these rather than the raw documents: a card's look count and the
 * looks behind it come from the same query, so they cannot drift apart.
 */
export const getCelebrityViews = cache(async () => {
  const [celebrities, outfits] = await Promise.all([getCelebrities(), getOutfits()]);
  return celebrityViews(celebrities, outfits);
});

export const getCelebrityBySlug = cache(async (slug: string) => {
  const celebrities = await getCelebrityViews();
  return celebrities.find((celebrity) => celebritySlug(celebrity) === slug);
});

export const getOccasions = cache(async (): Promise<Occasion[]> => {
  const db = await getDb();
  return db
    .collection<Occasion>("occasions")
    .find({}, NO_ID)
    .sort({ id: 1 })
    .toArray();
});

export const getOccasionViews = cache(async () => {
  const [occasions, outfits] = await Promise.all([getOccasions(), getOutfits()]);
  return occasionViews(occasions, outfits);
});

export const getOccasionBySlug = cache(async (slug: string) => {
  const occasions = await getOccasionViews();
  return occasions.find((occasion) => occasionSlug(occasion) === slug);
});

/**
 * The rows exactly as an editor stored them. The admin list and the admin edit
 * form read these, so editing a row cannot write a computed blurb back over
 * the editor's own wording.
 *
 * Nothing public should use this. Public surfaces read `getTrendingRows()`.
 */
export const getTrendingSearches = cache(async (): Promise<TrendingSearch[]> => {
  const db = await getDb();
  const searches = await db
    .collection<TrendingSearch>("trendingSearches")
    .find({}, NO_ID)
    .sort({ volume: -1 })
    .toArray();

  const [outfits, celebrities, occasions] = await Promise.all([
    getOutfits(),
    getCelebrityViews(),
    getOccasionViews(),
  ]);
  const livePaths = new Set([
    "/",
    "/outfits",
    "/celebrities",
    "/occasions",
    "/budget",
    "/trending",
    "/saved",
    "/search",
    ...outfits.map((outfit) => `/outfits/${outfitSlug(outfit)}`),
    ...celebrities.map((celebrity) => `/celebrities/${celebritySlug(celebrity)}`),
    ...occasions.map((occasion) => `/occasions/${occasionSlug(occasion)}`),
  ]);

  return searches.map((search) => {
    // A leaderboard row is editorial and can outlive the page it once linked
    // to. Keep the question visible, but never publish a dead destination.
    const pathname = search.href.startsWith("/") && !search.href.startsWith("//")
      ? search.href.split(/[?#]/)[0]
      : "";
    return livePaths.has(pathname)
      ? search
      : { ...search, href: `/search?q=${encodeURIComponent(search.term)}` };
  });
});

/**
 * The leaderboard as the public site publishes it: every blurb computed from
 * the looks the term actually finds, and every row that finds nothing pointed
 * at the search results for it rather than at a page that cannot answer the
 * question.
 *
 * The stored `answer` is dropped here rather than in the components, so there
 * is one place where a fabricated blurb could get back onto the site and it is
 * this function.
 */
export const getTrendingRows = cache(async (): Promise<TrendingRow[]> => {
  const [searches, outfits, celebrities, occasions] = await Promise.all([
    getTrendingSearches(),
    getOutfits(),
    getCelebrityViews(),
    getOccasionViews(),
  ]);

  const answerFor = trendingAnswerer({ outfits, celebrities, occasions });

  return searches.map((search) => {
    const answer = answerFor(search.term);
    return {
      ...search,
      answer: answer.text,
      decoded: answer.decoded,
      // A question we have not answered goes to the search results for it,
      // which say honestly what the archive holds and lead somewhere real.
      href: answer.decoded
        ? search.href
        : `/search?q=${encodeURIComponent(search.term)}`,
    };
  });
});

type SiteDoc<T> = { key: string; value: T };

async function siteContent<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  const doc = await db
    .collection<SiteDoc<T>>("siteContent")
    .findOne({ key }, NO_ID);
  return doc?.value;
}

export const getHomeContent = cache(async () => {
  const home = await siteContent<HomeContent>("home");
  if (!home) throw new Error("siteContent/home is missing. Run npm run seed:content.");
  return home;
});

/**
 * The reels the mirror last stored, with our own thumbnails.
 *
 * Empty until `npm run instagram:mirror` has run, which is the same state the
 * section already handled when no token was configured: it is simply absent.
 */
export const getMirroredReels = cache(async (): Promise<InstagramReel[]> => {
  return (await siteContent<InstagramReel[]>("reels")) ?? [];
});

export const getTrendingFaqs = cache(async () => {
  const [faqs, outfits] = await Promise.all([
    siteContent<{ q: string; a: string }[]>("trendingFaqs").then((value) => value ?? []),
    getOutfits(),
  ]);

  return faqs.map((faq) => {
    const question = faq.q.toLowerCase();
    if (question.includes("decide what is trending")) {
      return { ...faq, a: TRENDING_METHOD_ANSWER };
    }
    if (question.includes("prices") && question.includes("current")) {
      return {
        ...faq,
        a: "Every outfit page shows its exact verification date and warns when a recheck is due. Retailers change prices without warning, so always confirm the current figure on the retailer page.",
      };
    }
    // "Often, yes … mostly in the airport, casual and sangeet categories" was
    // a claim about an archive that did not exist: it named categories by
    // guess and promised a result the reader could not reproduce. Answered
    // from the looks that actually rebuild under the ceiling, or not promised.
    if (question.includes("under") && question.includes("5,000")) {
      return { ...faq, a: underBudgetAnswer(outfits) };
    }
    return faq;
  });
});

/** The honest answer to "can I find a full celebrity look under ₹5,000?" */
function underBudgetAnswer(outfits: Outfit[]): string {
  const within = completeLooks(outfits).filter(
    (outfit) => pricing(outfit).swapTotal <= UNDER_5K,
  );

  if (within.length < MIN_LOOKS_FOR_UNDER_5K) {
    return (
      `Sometimes. A complete look only counts here once every piece in it has an ` +
      `alternative we have found and priced, and the archive holds ${plural(within.length, "look")} ` +
      `that rebuilds for ${inr(UNDER_5K)} or less today. Sort the archive by budget to ` +
      `see exactly what that is, rather than taking our word for how common it is.`
    );
  }

  const occasions = [...new Set(within.map((outfit) => outfit.occasion.toLowerCase()))];
  const cheapest = Math.min(...within.map((outfit) => pricing(outfit).swapTotal));
  return (
    `Often, yes. ${plural(within.length, "look")} in the archive currently rebuilds for ` +
    `${inr(UNDER_5K)} or less, the cheapest at ${inr(cheapest)}, mostly in the ` +
    `${occasions.slice(0, 3).join(", ")} categories where the original leans on one ` +
    `expensive piece rather than four. Sort the archive by budget to see them.`
  );
}

export const getCelebrityRequests = cache(async (): Promise<CelebrityRequest[]> => {
  const db = await getDb();
  return db
    .collection<CelebrityRequest>("celebrityRequests")
    .find({}, NO_ID)
    // Most-wanted first, then whoever has been waiting longest.
    .sort({ votes: -1, firstAskedAt: 1 })
    .toArray();
});

export const getSubscribers = cache(async (): Promise<Subscriber[]> => {
  const db = await getDb();
  return db
    .collection<Subscriber>("subscribers")
    .find({}, NO_ID)
    .sort({ joinedAt: -1 })
    .toArray();
});

/** One address, read fresh. The sender checks this immediately before writing
 *  to somebody, so it must not be cached across the batch. */
export async function getSubscriberByEmail(email: string) {
  const db = await getDb();
  return db.collection<Subscriber>("subscribers").findOne({ email }, NO_ID);
}

export const getMailJobs = cache(async (): Promise<MailJob[]> => {
  const db = await getDb();
  return db
    .collection<MailJob>("mailJobs")
    .find({}, NO_ID)
    .sort({ createdAt: -1 })
    .toArray();
});

export const getPriceReports = cache(async (): Promise<PriceReport[]> => {
  const db = await getDb();
  return db
    .collection<PriceReport>("priceReports")
    .find({}, NO_ID)
    .sort({ receivedAt: -1 })
    .toArray();
});

/**
 * Where a retired URL went, or null if it never existed.
 *
 * Read only when a slug matches nothing live, so a name that comes back into
 * use is served by the record rather than by its own history.
 */
const movedSlug = cache(async (kind: SlugRedirect["kind"], from: string) => {
  const db = await getDb();
  const row = await db.collection<SlugRedirect>("redirects").findOne({ kind, from }, NO_ID);
  return row?.to ?? null;
});

export const movedOutfitSlug = (slug: string) => movedSlug("outfit", slug);
export const movedCelebritySlug = (slug: string) => movedSlug("celebrity", slug);
export const movedOccasionSlug = (slug: string) => movedSlug("occasion", slug);
