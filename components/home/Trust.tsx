import { getHomeContent } from "@/lib/db/content";
import { TrustSection } from "./TrustSection";

export async function Trust() {
  /**
   * Rendered exactly as stored.
   *
   * There used to be a patch here that rewrote any point mentioning "weekly",
   * because the stored copy claimed weekly link checks that nobody performed.
   * Papering over the text at render left the false sentence in the database,
   * one regex away from being published again — so the copy was fixed at
   * source instead, and this no longer matches anything.
   */
  const { trustPoints: points } = await getHomeContent();
  return <TrustSection points={points} />;
}
