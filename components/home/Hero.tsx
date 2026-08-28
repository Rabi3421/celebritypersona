import { RollingTotal } from "./RollingTotal";
import { inr } from "@/lib/format";
import { heroLook, heroTotals } from "@/lib/home-content";

export function Hero() {
  const pills = heroLook.items.slice(0, 3);

  return (
    <section className="hero">
      <div className="hero-in">
        <figure className="hero-photo rv">
          <svg className="figure" viewBox="0 0 120 300" fill="none" aria-hidden="true">
            <ellipse cx="60" cy="26" rx="17" ry="21" fill="rgba(255,255,255,.30)" />
            <path
              d="M60 47c-16 0-27 9-30 24l-6 62c-1 8 3 12 10 12h52c7 0 11-4 10-12l-6-62c-3-15-14-24-30-24z"
              fill="rgba(255,255,255,.34)"
            />
            <path
              d="M34 145h52l-5 96c-1 7-4 10-10 10H49c-6 0-9-3-10-10l-5-96z"
              fill="rgba(255,255,255,.26)"
            />
            <rect x="82" y="96" width="26" height="34" rx="4" fill="rgba(255,255,255,.30)" />
          </svg>
          <span className="stamp">
            <em aria-hidden="true" />
            Latest decode
          </span>
          {pills.map((item, i) => (
            <span className="pill" data-pill={i + 1} key={item.short}>
              {item.short} <s>{inr(item.worn)}</s> <b>{inr(item.swap)}</b>
            </span>
          ))}
          <figcaption className="credit">{heroLook.photoCredit}</figcaption>
        </figure>

        <div className="hero-copy">
          <p className="kicker rv">
            {heroLook.date} · {heroLook.occasion} · {heroLook.items.length} pieces
          </p>
          <h1 className="rv rv-d1">{heroLook.headline}</h1>
          <p className="where rv rv-d2">{heroLook.summary}</p>

          <div className="mini rv rv-d3">
            {heroLook.items.map((item) => (
              <div className="mini-row" key={item.name}>
                <div>
                  <div className="nm">{item.name}</div>
                  <div className="br">
                    {item.wornBrand} → {item.swapBrand}
                  </div>
                </div>
                <div className="pp">
                  <s>{inr(item.worn)}</s>
                  <b>{inr(item.swap)}</b>
                </div>
              </div>
            ))}
            <div className="mini-tot">
              <span className="l">Get the whole look</span>
              <span className="r">
                <s className="was">{inr(heroTotals.worn)}</s>
                <RollingTotal
                  className="now mono"
                  from={heroTotals.worn}
                  to={heroTotals.swap}
                />
              </span>
            </div>
          </div>

          <div className="hero-cta rv rv-d4">
            <button className="btn btn-primary">
              <span>See the full breakdown →</span>
            </button>
            <button className="btn btn-ghost">Browse 486 looks</button>
          </div>
        </div>
      </div>
    </section>
  );
}
