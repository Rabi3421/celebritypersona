import "server-only";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/mongodb";
import type {
  Celebrity,
  HomeContent,
  Occasion,
  Outfit,
  OutfitItem,
  PriceReport,
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

/** Totals are always the sum of the pieces, never typed in by hand. */
export const outfitTotals = (items: OutfitItem[]) => ({
  worn: items.reduce((sum, item) => sum + item.worn, 0),
  swap: items.reduce((sum, item) => sum + item.swap, 0),
});

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
  await db
    .collection<Outfit>("outfits")
    .updateOne({ id }, { $set: { ...input, ...outfitTotals(input.items) } });
  revalidateSite();
}

export async function deleteOutfit(id: number) {
  const db = await getDb();
  await db.collection<Outfit>("outfits").deleteOne({ id });
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

export async function setPriceReportStatus(
  id: string,
  status: PriceReport["status"],
) {
  const db = await getDb();
  await db.collection<PriceReport>("priceReports").updateOne({ id }, { $set: { status } });
  revalidatePath("/admin/reports");
}

export async function deletePriceReport(id: string) {
  const db = await getDb();
  await db.collection<PriceReport>("priceReports").deleteOne({ id });
  revalidatePath("/admin/reports");
}

/* ------------------------------------------------------------ home content */

export async function saveHomeContent(value: HomeContent) {
  const db = await getDb();
  await db
    .collection("siteContent")
    .updateOne({ key: "home" }, { $set: { key: "home", value } }, { upsert: true });
  revalidateSite();
}
