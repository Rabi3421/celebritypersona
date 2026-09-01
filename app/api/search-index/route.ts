import { buildSearchIndex } from "@/lib/search";
import { getCelebrities, getOccasions, getOutfits } from "@/lib/db/content";

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
  const [outfits, celebrities, occasions] = await Promise.all([
    getOutfits(),
    getCelebrities(),
    getOccasions(),
  ]);

  return Response.json(buildSearchIndex({ outfits, celebrities, occasions }));
}
