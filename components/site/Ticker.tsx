import { inr } from "@/lib/format";
import { getHomeContent } from "@/lib/db/content";

/** Infinite marquee of recent decodes. The list is rendered twice so the
 *  50%-translate keyframe loops seamlessly. */
export async function Ticker() {
  const { tickerEntries } = await getHomeContent();

  const loop = [...tickerEntries, ...tickerEntries];

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
