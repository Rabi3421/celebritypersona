import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { inr } from "@/lib/format";
import { revealClass } from "@/lib/reveal";
import { budgetTiers } from "@/lib/archive";
import { getOutfits } from "@/lib/db/content";

/** Price ceilings taken from the spread of what the archive's complete looks
 *  actually cost, each carrying the number of looks it really buys. The tile
 *  hands its cap to the explorer so the slider opens where you clicked. */
export async function Budget() {
  const tiers = budgetTiers(await getOutfits());
  if (tiers.length === 0) return null;

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
        {tiers.map((tier, i) => (
          <Link
            href={`/budget?budget=${tier.cap}`}
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
            <p className="cnt">
              {tier.looks} {tier.looks === 1 ? "look" : "looks"}
            </p>
            <span className="arw" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
