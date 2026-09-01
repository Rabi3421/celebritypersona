import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { inr } from "@/lib/format";
import { revealClass } from "@/lib/reveal";
import { getOutfits } from "@/lib/db/content";
import { thisWeekFrom } from "@/lib/this-week";

/** Reads the outfits collection rather than the homepage document: whatever an
 *  editor publishes in the panel is what this rail shows. */
export async function DecodedThisWeek() {
  const { cards, count, fellBack } = thisWeekFrom(await getOutfits());
  if (cards.length === 0) return null;

  const blurb = fellBack
    ? `The ${cards.length} most recent looks we have decoded. Hover any card to see what's inside.`
    : `${count} new ${count === 1 ? "look" : "looks"} in the last seven days. Hover any card to see what's inside.`;

  return (
    <section className="sec">
      <SectionHeading
        eyebrow="Fresh"
        title="Decoded this week"
        blurb={blurb}
        moreLabel="All outfits →"
        moreHref="/outfits"
      />
      <div className="rail">
        {cards.map((look, i) => (
          <article className={`card ${revealClass(i)}`} key={look.slug}>
            <Link href={`/outfits/${look.slug}`}>
              <div className={look.tone ? `ph ${look.tone}` : "ph"}>
                <div className="inner">
                  <Image
                    className="home-cover"
                    src={look.image ?? `https://picsum.photos/seed/cp-week-${i + 1}/600/750`}
                    alt={`${look.celebrity} at ${look.event}`}
                    fill
                    sizes="(max-width: 700px) 72vw, 20vw"
                  />
                </div>
                <span className="when">{look.posted}</span>
                {look.peek.length > 0 ? (
                  <ul className="peek">
                    {look.peek.map((piece) => (
                      <li key={piece.label}>
                        {piece.label} <b>{inr(piece.price)}</b>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="bd">
                <h3>{look.celebrity}</h3>
                <p className="dt">{look.event}</p>
                <p className="pr">
                  {/* Only strike a figure the swap actually replaces, and never
                      promise a swap total for a look that has none yet. */}
                  <span className={look.swap === null ? "" : "was"}>
                    {look.worn === null ? "Price unconfirmed" : inr(look.worn)}
                  </span>
                  {look.swap === null ? (
                    <span className="soon">No swap yet</span>
                  ) : (
                    <span className="now">{inr(look.swap)}</span>
                  )}
                </p>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
