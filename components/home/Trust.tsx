import { trustPoints } from "@/lib/home-content";
import { revealClass } from "@/lib/reveal";

export function Trust() {
  return (
    <section className="trust">
      <div className="shell in">
        <h2 className="rv">How we decode a look</h2>
        <p className="sub rv rv-d1">
          No scraping, no guessing, no fake links. If we can&apos;t verify something,
          we say so.
        </p>
        <div className="tgrid">
          {trustPoints.map((point, i) => (
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
