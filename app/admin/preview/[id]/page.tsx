import { notFound } from "next/navigation";
import { OutfitDetail } from "@/components/outfits/OutfitDetail";
import { Footer } from "@/components/site/Footer";
import { Nav } from "@/components/site/Nav";
import { requireAdmin } from "@/lib/auth/admin";
import { getAllOutfits } from "@/lib/db/content";
import { headline } from "@/lib/outfit-seo";
import { isPublished } from "@/lib/types";
import styles from "@/app/admin/panel.module.css";

/**
 * A look exactly as its public page would draw it, for an editor — drafts
 * included, which have no public page at all.
 *
 * Under /admin, so the proxy and the admin layout keep it out of every index
 * and behind the session; `requireAdmin` is the check that actually holds.
 * Rendered on each request, never cached, because the point is to see the
 * record as it stands.
 */
export const dynamic = "force-dynamic";

export default async function OutfitPreview({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const outfit = (await getAllOutfits()).find((item) => String(item.id) === id);
  if (!outfit) notFound();

  const live = isPublished(outfit);
  return (
    <>
      <p className={styles.previewBanner} role="status">
        Preview · {live ? "this look is live" : outfit.status === "draft" ? "draft — not on the site" : "not live: it needs a swap or a confirmed price"}
        {" · "}
        <a href={`/admin/outfits/${outfit.id}`}>Back to the editor</a>
      </p>
      <Nav active="outfits" />
      <OutfitDetail outfit={outfit} heading={headline(outfit)} sameCelebrity={[]} sameOccasion={[]} />
      <Footer />
    </>
  );
}
