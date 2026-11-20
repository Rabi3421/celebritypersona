import { HomePreviewFrame } from "@/components/admin/home/HomePreviewFrame";
import { requireAdmin } from "@/lib/auth/admin";
import { heroLook, homeStats, looksInGroup } from "@/lib/archive";
import { getHomeContent, getOccasions, getPublishedOutfits } from "@/lib/db/content";
import { MIN_WEDDING_LOOKS } from "@/lib/thresholds";

/**
 * The Homepage Studio's live preview, loaded in an iframe beside the editor.
 *
 * Draws one homepage section with the public homepage's own components and
 * stylesheet, from published looks (as the homepage does) and the copy the
 * editor sends — unsaved edits included. It only ever reads; it has no form
 * and no action, and writes nothing.
 *
 * Under /admin, so the proxy and the admin layout keep it out of every index
 * and behind the session; `requireAdmin` is the check that holds. Same-origin
 * framing is already allowed by the site's own headers.
 */
export const dynamic = "force-dynamic";

export default async function HomePreviewPage() {
  await requireAdmin();
  const [home, outfits, occasions] = await Promise.all([getHomeContent(), getPublishedOutfits(), getOccasions()]);
  return (
    <HomePreviewFrame
      initial={home}
      hero={heroLook(outfits)}
      stats={homeStats(outfits)}
      weddingLooks={looksInGroup(occasions, outfits, "Wedding").length}
      minWeddingLooks={MIN_WEDDING_LOOKS}
    />
  );
}
