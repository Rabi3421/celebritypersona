import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { inr } from "@/lib/format";
import { revealClass } from "@/lib/reveal";
import { BUDGET_CAPS, budgetSlug, looksUnder } from "@/lib/budget";
import { getPublishedOutfits } from "@/lib/db/content";

/**
 * One tile per budget page that has looks on it, each linking to that page.
 *
 * The tiles used to invent their own ceilings from the spread of complete-look
 * prices ("under ₹4,000") and send the reader to the explorer; now that every
 * budget has a page of its own, a tile says exactly what its page lists —
 * the same cap, the same count — so the click lands where it promised.
 */
export async function Budget() {
  const outfits = await getPublishedOutfits();
  const tiers = BUDGET_CAPS.map((cap) => ({ cap, looks: looksUnder(outfits, cap).length })).filter(
    (tier) => tier.looks > 0,
  );
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
      <div className="budget" style={{ "--cols": tiers.length } as React.CSSProperties}>
        {tiers.map((tier, i) => (
          <Link
            href={`/budget/${budgetSlug(tier.cap)}`}
            className={`btile ${revealClass(i)}`}
            key={tier.cap}
          >
            <p className="cap">Celebrity looks under</p>
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
