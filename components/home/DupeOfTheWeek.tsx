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
            <Image
              className="home-cover"
              src={dupe.worn.image ?? "https://picsum.photos/seed/cp-dupe-designer/800/800"}
              alt={`${dupe.celebrity} wearing the ${dupe.worn.brand} piece`}
              fill
              sizes="(max-width: 700px) 80vw, 38vw"
            />
          </div>
          <p className="lbl">As worn</p>
          <p className="nm">{dupe.worn.name}</p>
          <p className="amt mono">{inr(dupe.worn.price)}</p>
        </div>
        <div className="dvs">VS</div>
        <div className="dside b">
          <div className="box">
            <Image
              className="home-cover"
              src={dupe.swap.image ?? "https://picsum.photos/seed/cp-dupe-swap/800/800"}
              alt={`The ${dupe.swap.brand} alternative`}
              fill
              sizes="(max-width: 700px) 80vw, 38vw"
            />
          </div>
          <p className="lbl">The swap</p>
          <p className="nm">{dupe.swap.name}</p>
          <p className="amt mono">{inr(dupe.swap.price)}</p>
        </div>
      </div>
    </section>
  );
}
