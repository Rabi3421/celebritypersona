import Image from "next/image";
import { SectionHeading } from "./SectionHeading";
import { inr } from "@/lib/format";
import { dupeOfTheWeek } from "@/lib/home-content";

export function DupeOfTheWeek() {
  return (
    <section className="sec">
      <SectionHeading
        eyebrow="Editor's pick"
        title="Dupe of the week"
        moreLabel="Past picks →"
      />
      <div className="dupe rv rv-d1">
        <div className="dside a">
          <div className="box">
            <Image
              className="home-cover"
              src="https://picsum.photos/seed/cp-dupe-designer/800/800"
              alt="Sample designer lehenga"
              fill
              sizes="(max-width: 700px) 80vw, 38vw"
            />
          </div>
          <p className="lbl">As worn</p>
          <p className="nm">{dupeOfTheWeek.worn.name}</p>
          <p className="amt mono">{inr(dupeOfTheWeek.worn.price)}</p>
        </div>
        <div className="dvs">VS</div>
        <div className="dside b">
          <div className="box">
            <Image
              className="home-cover"
              src="https://picsum.photos/seed/cp-dupe-swap/800/800"
              alt="Sample affordable embroidered lehenga"
              fill
              sizes="(max-width: 700px) 80vw, 38vw"
            />
          </div>
          <p className="lbl">The swap</p>
          <p className="nm">{dupeOfTheWeek.swap.name}</p>
          <p className="amt mono">{inr(dupeOfTheWeek.swap.price)}</p>
        </div>
      </div>
    </section>
  );
}
