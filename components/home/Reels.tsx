import { SectionHeading } from "./SectionHeading";
import { social } from "@/lib/site-config";
import { getMirroredReels } from "@/lib/db/content";
import { ReelStrip } from "./ReelStrip";

/**
 * The account's own reels, rendered from our own copies.
 *
 * There used to be a fallback that drew stock photographs from picsum.photos
 * under the heading "60-second decodes", captioned with view counts typed into
 * the homepage form — reels that do not exist, presented as ours. After that
 * the section read Instagram live and rendered Meta's own expiring CDN URLs;
 * see lib/instagram.ts for why that went too. If nothing has been mirrored the
 * section is simply absent.
 */
export async function Reels() {
  const reels = await getMirroredReels();
  if (reels.length === 0) return null;

  return (
    <section className="sec">
      <SectionHeading
        eyebrow="Watch"
        title="60-second decodes"
        blurb="The same breakdowns, in Hindi, on Instagram and YouTube."
        moreLabel="Follow @celebritypersona →"
        moreHref={social.instagram}
      />
      <ReelStrip reels={reels} />
    </section>
  );
}
