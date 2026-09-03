import { BlankFrame } from "@/components/site/Thumb";
import Image from "next/image";
import { SectionHeading } from "./SectionHeading";
import { inr } from "@/lib/format";
import { dupeOfTheWeek } from "@/lib/archive";
import { getOutfits } from "@/lib/db/content";

/** The widest single-piece gap in the archive. The pick used to be two product
 *  names typed into the homepage form, with no look behind them. */
export async function DupeOfTheWeek() {
  const dupe = dupeOfTheWeek(await getOutfits());
  if (!dupe) return null;

  return (
    <section className="sec">
      <SectionHeading
        eyebrow="Editor's pick"
        title="Dupe of the week"
        moreLabel="See the full look →"
        moreHref={`/outfits/${dupe.slug}`}
      />
      <div className="dupe rv rv-d1">
        <div className="dside a">
          <div className="box">
            {dupe.worn.image ? (
              <Image
                className="home-cover"
                src={dupe.worn.image}
                alt={`${dupe.celebrity} wearing the ${dupe.worn.name} by ${dupe.worn.brand}`}
                fill
                sizes="(max-width: 700px) 80vw, 38vw"
              />
            ) : (
              <BlankFrame seed={dupe.worn.brand} />
            )}
          </div>
          <p className="lbl">As worn</p>
          <p className="nm">{dupe.worn.name}</p>
          <p className="amt mono">{inr(dupe.worn.price)}</p>
        </div>
        <div className="dvs">VS</div>
        <div className="dside b">
          <div className="box">
            {dupe.swap.image ? (
              <Image
                className="home-cover"
                src={dupe.swap.image}
                alt={`The ${dupe.swap.name} by ${dupe.swap.brand}, the affordable alternative`}
                fill
                sizes="(max-width: 700px) 80vw, 38vw"
              />
            ) : (
              <BlankFrame seed={dupe.swap.brand} />
            )}
          </div>
          <p className="lbl">The swap</p>
          <p className="nm">{dupe.swap.name}</p>
          <p className="amt mono">{inr(dupe.swap.price)}</p>
        </div>
      </div>
    </section>
  );
}
