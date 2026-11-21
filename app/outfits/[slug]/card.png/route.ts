import { publicShareImage } from "@/lib/share-route";

/** The look's share card (link previews). See lib/share-image.tsx. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return publicShareImage((await params).slug, "card");
}
