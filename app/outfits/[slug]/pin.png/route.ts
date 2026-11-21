import { publicShareImage } from "@/lib/share-route";

/** The look's Pinterest pin. See lib/share-image.tsx. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return publicShareImage((await params).slug, "pin");
}
