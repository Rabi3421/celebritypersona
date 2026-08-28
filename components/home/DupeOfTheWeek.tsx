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
          <div className="box" />
          <p className="lbl">As worn</p>
          <p className="nm">{dupeOfTheWeek.worn.name}</p>
          <p className="amt mono">{inr(dupeOfTheWeek.worn.price)}</p>
        </div>
        <div className="dvs">VS</div>
        <div className="dside b">
          <div className="box" />
          <p className="lbl">The swap</p>
          <p className="nm">{dupeOfTheWeek.swap.name}</p>
          <p className="amt mono">{inr(dupeOfTheWeek.swap.price)}</p>
        </div>
      </div>
    </section>
  );
}
