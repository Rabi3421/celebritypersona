import Image from "next/image";
import { SectionHeading } from "./SectionHeading";
import { inr } from "@/lib/format";
import { thisWeek } from "@/lib/home-content";
import { revealClass } from "@/lib/reveal";

export function DecodedThisWeek() {
  return (
    <section className="sec">
      <SectionHeading
        eyebrow="Fresh"
        title="Decoded this week"
        blurb="Eleven new looks since Monday. Hover any card to see what's inside."
        moreLabel="All outfits →"
        moreHref="/outfits"
      />
      <div className="rail">
        {thisWeek.map((look, i) => (
          <article className={`card ${revealClass(i)}`} key={look.celebrity}>
            <div className={look.tone ? `ph ${look.tone}` : "ph"}>
              <div className="inner">
                <Image
                  className="home-cover"
                  src={`https://picsum.photos/seed/cp-week-${i + 1}/600/750`}
                  alt={`Sample ${look.occasion} look inspired by ${look.celebrity}`}
                  fill
                  sizes="(max-width: 700px) 72vw, 20vw"
                />
              </div>
              <span className="when">{look.posted}</span>
              <ul className="peek">
                {look.peek.map((piece) => (
                  <li key={piece.label}>
                    {piece.label} <b>{inr(piece.price)}</b>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bd">
              <h3>{look.celebrity}</h3>
              <p className="dt">{look.occasion}</p>
              <p className="pr">
                <span className="was">{inr(look.worn)}</span>
                <span className="now">{inr(look.swap)}</span>
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
