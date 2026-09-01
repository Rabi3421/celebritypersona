import { inr } from "@/lib/format";
import { tickerEntries } from "@/lib/archive";
import { getOutfits } from "@/lib/db/content";

/** Infinite marquee of the most recent complete decodes, read off the outfits
 *  themselves. The list is rendered twice so the 50%-translate keyframe loops
 *  seamlessly. */
export async function Ticker() {
  const entries = tickerEntries(await getOutfits());
  if (entries.length === 0) return null;

  const loop = [...entries, ...entries];

  return (
    <div className="ticker">
      <div className="tick-track">
        {loop.map((entry, i) => (
          <span className="tick-item" key={`${entry.celebrity}-${i}`}>
            <em>Just decoded</em> {entry.celebrity} · {entry.occasion}{" "}
            <s>{inr(entry.worn)}</s> → <b>{inr(entry.swap)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
