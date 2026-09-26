import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Routes that read the archive but sit outside the root layout, so
 * `revalidatePath("/", "layout")` does not reach them. Each has to be named.
 *
 * The panel only ever refreshed the layout, which is how the sitemap went on
 * omitting five published looks for days after they were created: every page
 * they appear on was current, and the one file that tells Google they exist
 * was not.
 */
export const STANDALONE_PATHS = ["/sitemap.xml", "/llms.txt", "/api/search-index"] as const;

/** Everything public that is built from the database: every page under the
 *  root layout, and the standalone routes above. */
export function revalidatePublicSite() {
  revalidatePath("/", "layout");
  for (const path of STANDALONE_PATHS) revalidatePath(path);
}
