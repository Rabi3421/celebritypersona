import "server-only";
import { cache } from "react";
import { getDb } from "@/lib/mongodb";
import { celebrityViews, occasionViews } from "@/lib/archive";
import { celebritySlug, occasionSlug, outfitSlug } from "@/lib/slugs";
import type {
  Celebrity,
  CelebrityRequest,
  HomeContent,
  MailJob,
  Occasion,
  Outfit,
  PriceReport,
  Subscriber,
  TrendingSearch,
} from "@/lib/types";

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

export const getTrendingSearches = cache(async (): Promise<TrendingSearch[]> => {
  const db = await getDb();
  return db
    .collection<TrendingSearch>("trendingSearches")
    .find({}, NO_ID)
    .sort({ volume: -1 })
    .toArray();
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

export const getTrendingFaqs = cache(async () => {
  return (await siteContent<{ q: string; a: string }[]>("trendingFaqs")) ?? [];
});

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
