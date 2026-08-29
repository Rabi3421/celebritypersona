import "server-only";
import { cache } from "react";
import { getDb } from "@/lib/mongodb";
import { celebritySlug, occasionSlug, outfitSlug } from "@/lib/slugs";
import type {
  Celebrity,
  HomeContent,
  Occasion,
  Outfit,
  PriceReport,
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

export const getCelebrityBySlug = cache(async (slug: string) => {
  const celebrities = await getCelebrities();
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

export const getOccasionBySlug = cache(async (slug: string) => {
  const occasions = await getOccasions();
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

export const getPriceReports = cache(async (): Promise<PriceReport[]> => {
  const db = await getDb();
  return db
    .collection<PriceReport>("priceReports")
    .find({}, NO_ID)
    .sort({ receivedAt: -1 })
    .toArray();
});
