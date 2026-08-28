import Image from "next/image";
import { RollingTotal } from "./RollingTotal";
import { inr } from "@/lib/format";
import { heroLook, heroTotals } from "@/lib/home-content";

export function Hero() {
  const pills = heroLook.items.slice(0, 3);

  return (
    <section className="hero">
      <div className="hero-in">
        <figure className="hero-photo rv">
          <Image
            className="home-cover hero-image"
            src="https://picsum.photos/seed/cp-home-alia/900/1125"
            alt="Sample editorial outfit for the latest Alia Bhatt decode"
            fill
            priority
            sizes="(max-width: 760px) 100vw, 48vw"
          />
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
