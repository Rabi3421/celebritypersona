import { readSession } from "@/lib/auth/session";
import { getAllOutfits } from "@/lib/db/content";
import { shareImage } from "@/lib/share-image";
import { SHARE_KINDS, type ShareKind } from "@/lib/share-text";

/**
 * GET /api/admin/share-image/<outfit id>?kind=card|pin[&download=1]
 *
 * The same images as the public routes, for any look — drafts included — so
 * the editor sees them in the preview before publishing. Signed-in only.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await readSession())) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "card";
  if (!(kind in SHARE_KINDS)) return new Response("Unknown kind", { status: 400 });
  const outfit = (await getAllOutfits()).find((item) => String(item.id) === id);
  if (!outfit) return new Response("Not found", { status: 404 });
  return shareImage(outfit, kind as ShareKind, {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex",
    ...(url.searchParams.get("download")
      ? { "Content-Disposition": `attachment; filename="celebritypersona-${outfit.id}-${kind}.png"` }
      : {}),
  });
}
