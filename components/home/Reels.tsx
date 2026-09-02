import Image from "next/image";
import { SectionHeading } from "./SectionHeading";
import { PlayIcon } from "@/components/site/Icons";
import { social } from "@/lib/site-config";
import { revealClass } from "@/lib/reveal";
import { getHomeContent } from "@/lib/db/content";
import { getInstagramReels } from "@/lib/instagram";
import { ReelStrip } from "./ReelStrip";

/**
 * The account's own reels, read live from Instagram.
 *
 * Until a token is configured the section falls back to the rows an editor
 * typed into the homepage form, so the page never loses a section over a
 * missing credential.
 */
export async function Reels() {
  const [live, { reels }] = await Promise.all([
    getInstagramReels(6),
    getHomeContent(),
  ]);

  if (live.length === 0 && reels.length === 0) return null;

  return (
    <section className="sec">
      <SectionHeading
        eyebrow="Watch"
        title="60-second decodes"
        blurb="The same breakdowns, in Hindi, on Instagram and YouTube."
        moreLabel="Follow @celebritypersona →"
        moreHref={social.instagram}
      />
      {live.length ? (
        <ReelStrip reels={live} />
      ) : (
        <div className="social">
          {reels.map((reel, i) => (
            <article className={`reel ${revealClass(i)}`} key={reel.caption}>
              <Image
                className="home-cover"
                src={`https://picsum.photos/seed/cp-reel-${i + 1}/450/800`}
                alt="Sample fashion decode reel cover"
                fill
                sizes="(max-width: 700px) 33vw, 17vw"
              />
              <span className="vw">{reel.views}</span>
              <span className="play">
                <PlayIcon />
              </span>
              <p className="cap">{reel.caption}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
