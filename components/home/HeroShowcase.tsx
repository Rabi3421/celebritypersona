import Image from "next/image";
import Link from "next/link";
import { inr } from "@/lib/format";

/** The newest look with a swap, shown in the hero so the first screen holds a
 *  real decoded look and its two prices, not only the artwork. */
export type HeroLatest = {
  href: string;
  celebrity: string;
  event: string;
  photo: string;
  worn: number | null;
  swap: number;
};

const DISCOVERY_LINKS = [
  { label: "Celebrity looks", href: "/celebrities" },
  { label: "Occasion edits", href: "/occasions" },
  { label: "Trend radar", href: "/trending" },
];

export function HeroShowcase({ latest }: { latest?: HeroLatest | null }) {
  return (
    <section className="hx" aria-labelledby="home-hero-title">
      <div className="hx-media" aria-hidden="true">
        {/*
          WebP rather than the 1.7MB PNG master, which is kept only as the
          source of truth and for the Open Graph card. The hero is the
          homepage's LCP element, and the optimizer had to pull that whole PNG
          out of the origin filesystem and transcode it on the first request of
          every new size — the same picture at the same 1672×941 is 66KB here,
          so the transform is cheap and the cold path is short.
        */}
        <Image
          src="/images/home/celebritypersona-hero-v2.webp"
          alt=""
          fill
          preload
          sizes="100vw"
        />
        <span className="hx-scrim" />
      </div>

      <div className="shell hx-in">
        <div className="hx-copy">
          {/* The kicker carries the brand line; the h1 says what the site is
              about, because "Know the look. Find your version." named the page
              for nothing anybody searches for. Both lines are the same length
              as the ones they replace, so the hero sets identically. */}
          <p className="hx-kicker">
            <em aria-hidden="true" />
            Know the look. Find your version.
          </p>

          <h1 className="hx-title" id="home-hero-title">
            Indian celebrity{" "}
            <span>outfits, decoded.</span>
          </h1>

          <p className="hx-lede">
            Every look broken down piece by piece — the exact brand she wore,
            what it costs, and an affordable alternative you can order in India.
            From airport arrivals and red carpets to sangeet and Diwali season.
          </p>

          {latest ? (
            <Link className="hx-latest" href={latest.href}>
              <span className="hx-latest-img">
                <Image src={latest.photo} alt="" fill sizes="64px" />
              </span>
              <span className="hx-latest-text">
                <em>Just decoded</em>
                <b>{latest.celebrity}</b>
                <small>{latest.event}</small>
              </span>
              <span className="hx-latest-price">
                {latest.worn !== null ? <s>{inr(latest.worn)}</s> : null}
                <b>{inr(latest.swap)}</b>
              </span>
            </Link>
          ) : null}

          <div className="hx-cta">
            <Link className="btn btn-primary" href="/outfits">
              <span>Explore latest looks →</span>
            </Link>
            <Link className="btn btn-ghost" href="/celebrities">
              Browse celebrities
            </Link>
          </div>

          <nav className="hx-discover" aria-label="Popular ways to explore">
            <span>Start with</span>
            {DISCOVERY_LINKS.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label} <i aria-hidden="true">↗</i>
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <p className="hx-credit">Original editorial artwork · CelebrityPersona</p>
    </section>
  );
}
