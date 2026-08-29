import Image from "next/image";
import { SectionHeading } from "./SectionHeading";
import { PlayIcon } from "@/components/site/Icons";
import { social } from "@/lib/site-config";
import { revealClass } from "@/lib/reveal";
import { getHomeContent } from "@/lib/db/content";

export async function Reels() {
  const { reels } = await getHomeContent();

  return (
    <section className="sec">
      <SectionHeading
        eyebrow="Watch"
        title="60-second decodes"
        blurb="The same breakdowns, in Hindi, on Instagram and YouTube."
        moreLabel="Follow @celebritypersona →"
        moreHref={social.instagram}
      />
      <div className="social">
        {reels.map((reel, i) => (
          <article className={`reel ${revealClass(i)}`} key={reel.caption}>
            <Image
              className="home-cover"
              src={`https://picsum.photos/seed/cp-reel-${i + 1}/450/800`}
              alt="Sample fashion decode reel cover"
              fill
              sizes="(max-width: 700px) 44vw, 17vw"
            />
            <span className="vw">{reel.views}</span>
            <span className="play">
              <PlayIcon />
            </span>
            <p className="cap">{reel.caption}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
