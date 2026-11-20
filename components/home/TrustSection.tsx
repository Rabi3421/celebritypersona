import { revealClass } from "@/lib/reveal";
import type { HomeContent } from "@/lib/types";

/**
 * The trust section's markup, exactly as the homepage draws it. Split out of
 * Trust (which reads the points from the database) so the admin's Homepage
 * Studio can preview the same markup with unsaved points.
 */
export function TrustSection({ points }: { points: HomeContent["trustPoints"] }) {
  return (
    <section className="trust">
      <div className="shell in">
        <h2 className="rv">How we decode a look</h2>
        <p className="sub rv rv-d1">
          No scraping, no guessing, no fake links. If we can&apos;t verify something,
          we say so.
        </p>
        <div className="tgrid">
          {points.map((point, i) => (
            <div className={`titem ${revealClass(i)}`} key={point.n}>
              <span className="n">{point.n}</span>
              <strong>{point.title}</strong>
              <p>{point.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
