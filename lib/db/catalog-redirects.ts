import type { ClientSession, Db } from "mongodb";
import type { SlugRedirect } from "@/lib/types";

/** Redirect changes commit or roll back with the record that moves. */
export async function rememberCatalogSlug(db: Db, session: ClientSession, kind: SlugRedirect["kind"], from: string, to: string) {
  if (!from || !to || from === to) return;
  const redirects = db.collection<SlugRedirect>("redirects");
  await redirects.updateMany({ kind, to: from }, { $set: { to } }, { session });
  await redirects.deleteMany({ kind, from: to }, { session });
  await redirects.updateOne({ kind, from }, { $set: { kind, from, to, at: new Date().toISOString() } }, { upsert: true, session });
}
