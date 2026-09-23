import { revealClass } from "@/lib/reveal";
import { getHomeContent } from "@/lib/db/content";
import { getPublishedOutfits } from "@/lib/db/content";
import { needsPriceReview } from "@/lib/freshness";

export async function Trust() {
  const [{ trustPoints }, outfits] = await Promise.all([getHomeContent(), getPublishedOutfits()]);
  const due = outfits.filter((outfit) => needsPriceReview(outfit.pricesCheckedAt)).length;
  const points = trustPoints.map((point) => {
    if (!/weekly/i.test(`${point.title} ${point.body}`)) return point;
    return {
      ...point,
      title: "Freshness shown on every look",
      body: due
        ? `${due} ${due === 1 ? "look is" : "looks are"} due for review. Every outfit shows its exact check date and warns readers when prices may have moved.`
        : "Every outfit shows its exact check date and warns readers when prices may have moved.",
    };
  });

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
