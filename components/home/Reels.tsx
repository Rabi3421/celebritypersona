import { SectionHeading } from "./SectionHeading";
import { PlayIcon } from "@/components/site/Icons";
import { reels } from "@/lib/home-content";
import { revealClass } from "@/lib/reveal";

export function Reels() {
  return (
    <section className="sec">
      <SectionHeading
        eyebrow="Watch"
        title="60-second decodes"
        blurb="The same breakdowns, in Hindi, on Instagram and YouTube."
        moreLabel="Follow @celebritypersona →"
      />
      <div className="social">
        {reels.map((reel, i) => (
          <article className={`reel ${revealClass(i)}`} key={reel.caption}>
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
