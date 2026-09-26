import { MongoClient } from "mongodb";

/**
 * Every URL move the site has recorded, as `redirects()` entries for
 * next.config.ts.
 *
 * The pages already answer a moved slug with `permanentRedirect()`, but a
 * redirect thrown while an ISR page renders goes out with its Location header
 * twice: Next sets it on the response and again from the render's cached
 * headers. Served from the config instead, the move is answered by the router
 * before any page renders — one 308, one Location, no render at all.
 *
 * Read once per build. A slug changed after the last deploy is still caught by
 * the page's own fallback until the next build picks it up here.
 *
 * Never fails the build: without a database it returns nothing, and the pages'
 * fallbacks carry on as before. Plain imports only, for next.config.ts.
 */

const PREFIX: Record<string, string> = {
  outfit: "/outfits",
  celebrity: "/celebrities",
  occasion: "/occasions",
  brand: "/brands",
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function storedRedirects() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return [];

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    const rows = await client
      .db(process.env.MONGODB_DB ?? "celebritypersona")
      .collection<{ kind: string; from: string; to: string }>("redirects")
      .find({}, { projection: { _id: 0, kind: 1, from: 1, to: 1 } })
      .toArray();

    return rows
      .filter((row) => PREFIX[row.kind] && SLUG.test(row.from) && SLUG.test(row.to) && row.from !== row.to)
      .map((row) => ({
        source: `${PREFIX[row.kind]}/${row.from}`,
        destination: `${PREFIX[row.kind]}/${row.to}`,
        permanent: true,
      }));
  } catch (error) {
    console.warn("Stored redirects not loaded; the pages' fallbacks still apply.", error instanceof Error ? error.message : "");
    return [];
  } finally {
    await client.close().catch(() => {});
  }
}
