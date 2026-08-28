import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { occasions } from "@/lib/home-content";
import { revealClass } from "@/lib/reveal";

export function Occasions() {
  return (
    <section className="sec">
      <SectionHeading
        eyebrow="Browse"
        title="By occasion"
        blurb="Wedding in six weeks? Start here."
        moreLabel="All occasions →"
        moreHref="/occasions"
      />
      <div className="occ">
        {occasions.map((occasion, i) => (
          <Link
            href={`/occasions/${occasion.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            className={`otile ${revealClass(i, 4)}`}
            key={occasion.name}
          >
            <div className="lab">
              <strong>{occasion.name}</strong>
              <span>{occasion.looks} looks</span>
              <p className="go">View →</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
