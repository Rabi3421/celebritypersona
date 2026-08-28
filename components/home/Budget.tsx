import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { inr } from "@/lib/format";
import { budgetTiers } from "@/lib/home-content";
import { revealClass } from "@/lib/reveal";

export function Budget() {
  return (
    <section className="sec">
      <SectionHeading
        eyebrow="The other way in"
        title="Start from your budget"
        blurb="Everyone else starts with the celebrity. Start with what you can actually spend instead."
        moreLabel="All budgets →"
        moreHref="/budget"
      />
      <div className="budget">
        {budgetTiers.map((tier, i) => (
          <Link
            href="/budget"
            className={`btile ${revealClass(i)}`}
            key={tier.cap}
          >
            <p className="cap">Complete looks under</p>
            <p className="big">{inr(tier.cap)}</p>
            <div className="bdots" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </div>
            <p className="cnt">{tier.looks} looks</p>
            <span className="arw" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
