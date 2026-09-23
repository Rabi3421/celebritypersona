import { revealClass } from "@/lib/reveal";
import { getHomeContent } from "@/lib/db/content";

export async function Trust() {
  /**
   * Rendered exactly as stored.
   *
   * There used to be a patch here that rewrote any point mentioning "weekly",
   * because the stored copy claimed weekly link checks that nobody performed.
   * Papering over the text at render left the false sentence in the database,
   * one regex away from being published again — so the copy was fixed at
   * source instead, and this no longer matches anything.
   */
  const { trustPoints: points } = await getHomeContent();

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
