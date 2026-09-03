import { SectionHeading } from "./SectionHeading";
import { social } from "@/lib/site-config";
import { getInstagramReels } from "@/lib/instagram";
import { ReelStrip } from "./ReelStrip";

/**
 * The account's own reels, read live from Instagram.
 *
 * There used to be a fallback that drew stock photographs from picsum.photos
 * under the heading "60-second decodes", captioned with view counts typed into
 * the homepage form — reels that do not exist, presented as ours. If the feed
 * is unavailable the section is simply absent.
 */
export async function Reels() {
  const live = await getInstagramReels(6);
  if (live.length === 0) return null;

  return (
    <section className="sec">
      <SectionHeading
        eyebrow="Watch"
        title="60-second decodes"
        blurb="The same breakdowns, in Hindi, on Instagram and YouTube."
        moreLabel="Follow @celebritypersona →"
        moreHref={social.instagram}
      />
      <ReelStrip reels={live} />
    </section>
  );
}
