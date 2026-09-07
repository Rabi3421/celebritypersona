import { buildSearchIndex } from "@/lib/search";
import { getCelebrityViews, getOccasionViews, getOutfits } from "@/lib/db/content";

/**
 * The search index, fetched once by the header search box the first time
 * someone opens it. Keeping it out of the page HTML means every page is not
 * carrying an index most visitors never use.
 *
 * Cached, and every content mutation revalidates the whole route tree, so an
 * edit shows up in search as soon as it shows up on the pages.
 */
export const revalidate = 3600;

export async function GET() {
  // The merged views, not the records: a celebrity or occasion the outfits
  // mention has a working page and sits in the sitemap, so search has to be
  // able to reach it too.
  const [outfits, celebrities, occasions] = await Promise.all([
    getOutfits(),
    getCelebrityViews(),
    getOccasionViews(),
  ]);

  return Response.json(buildSearchIndex({ outfits, celebrities, occasions }));
}
