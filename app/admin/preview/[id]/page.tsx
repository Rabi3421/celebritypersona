import { notFound } from "next/navigation";
import { OutfitDetail } from "@/components/outfits/OutfitDetail";
import { Footer } from "@/components/site/Footer";
import { Nav } from "@/components/site/Nav";
import { ReviewDock } from "@/components/admin/ReviewDock";
import { requireAdmin } from "@/lib/auth/admin";
import { headline } from "@/lib/outfit-seo";
import { publishReadiness } from "@/lib/publish-readiness";
import { outfitSlug } from "@/lib/slugs";

/**
 * A look exactly as its public page would draw it, for an editor — drafts
 * included, which have no public page at all — with the review panel beside
 * it: the research checks to confirm, anything else publishing needs, and
 * Publish itself.
 *
 * Under /admin, so the proxy and the admin layout keep it out of every index
 * and behind the session; `requireAdmin` is the check that actually holds.
 * Rendered on each request, never cached, because the point is to see the
 * record as it stands.
 */
export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default async function OutfitPreview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ published?: string; notPublished?: string }>;
}) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const readiness = /^\d+$/.test(id) ? await publishReadiness(Number(id)) : null;
  if (!readiness) notFound();
  const { outfit, job, live, blocking } = readiness;

  const cleared = new Map((job?.findings?.cleared ?? []).map((item) => [item.check, item]));
  const checks = (job?.findings?.checks ?? []).map((text) => {
    const done = cleared.get(text);
    return { text, done: Boolean(done), by: done?.by, at: done ? when.format(new Date(done.at)) : undefined };
  });

  return (
    <ReviewDock
      outfitId={outfit.id}
      jobId={job?.id}
      celebrity={outfit.celebrity}
      event={outfit.event}
      live={live}
      checks={checks}
      blocking={blocking.map((check) => ({ label: check.label, detail: check.detail, href: `/admin/outfits/${outfit.id}#${editorSection(check.id)}` }))}
      by={job?.findings?.by ?? []}
      editHref={`/admin/outfits/${outfit.id}`}
      publicHref={`/outfits/${outfitSlug(outfit)}`}
      share={[
        { label: "Share card", href: `/api/admin/share-image/${outfit.id}?kind=card` },
        { label: "Pinterest pin", href: `/api/admin/share-image/${outfit.id}?kind=pin` },
        { label: "Download the pin", href: `/api/admin/share-image/${outfit.id}?kind=pin&download=1`, download: true },
      ]}
      notice={query.published ? "published" : query.notPublished ? "notPublished" : null}
    >
      <Nav active="outfits" />
      <OutfitDetail outfit={outfit} heading={headline(outfit)} sameCelebrity={[]} sameOccasion={[]} />
      <Footer />
    </ReviewDock>
  );
}

/** The part of the editor that fixes a failing check, so "Fix" opens it rather than the top of a long form. */
function editorSection(checkId: string): string {
  if (["photos", "alt", "credit"].includes(checkId)) return "photos";
  if (checkId === "keyword-slug") return "slug";
  if (["about", "keyword-intro"].includes(checkId)) return "notes";
  if (["lead", "categories", "price", "decoded", "accessories", "rupees"].includes(checkId)) return "pieces";
  return "keyword";
}
