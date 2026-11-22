import { publicJpeg } from "@/lib/share-route";

/** See lib/share-route.ts. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return publicJpeg((await params).slug, "card");
}
