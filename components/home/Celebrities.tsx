import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { celebrities } from "@/lib/home-content";
import { revealClass } from "@/lib/reveal";

export function Celebrities() {
  return (
    <section className="sec">
      <SectionHeading
        eyebrow="Archives"
        title="Style archives"
        blurb="Every look we've decoded, organised per person."
        moreLabel="A–Z index →"
        moreHref="/celebrities"
      />
      <div className="celebs">
        {celebrities.map((celebrity, i) => (
          <Link
            href={`/celebrities/${celebrity.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            className={`ctile ${revealClass(i)}`}
            key={celebrity.name}
          >
            <div className="av" />
            <strong>{celebrity.name}</strong>
            <span>{celebrity.looks} looks</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
