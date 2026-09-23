import { inr } from "@/lib/format";
import { tickerEntries } from "@/lib/archive";
import { getPublishedOutfits } from "@/lib/db/content";

/** Infinite marquee of the most recent complete decodes, read off the outfits
 *  themselves. The list is rendered twice so the 50%-translate keyframe loops
 *  seamlessly. */
export async function Ticker() {
  const entries = tickerEntries(await getPublishedOutfits());
  if (entries.length === 0) return null;

  const loop = [...entries, ...entries];

  return (
    <div className="ticker">
      <div className="tick-track">
        {loop.map((entry, i) => (
          <span className="tick-item" key={`${entry.celebrity}-${i}`}>
            <em>Just decoded</em> {entry.celebrity} · {entry.occasion}{" "}
            {/* Striking out a price means we confirmed one. Where we did not,
                the entry says what the rebuild costs and claims nothing about
                the original — it used to print "₹0 → ₹3,999". */}
            {entry.worn === null ? (
              <>· swap <b>{inr(entry.swap)}</b></>
            ) : (
              <>
                <s>{inr(entry.worn)}</s> → <b>{inr(entry.swap)}</b>
              </>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
