import Image from "next/image";
import Link from "next/link";

const DISCOVERY_LINKS = [
  { label: "Celebrity looks", href: "/celebrities" },
  { label: "Occasion edits", href: "/occasions" },
  { label: "Trend radar", href: "/trending" },
];

export function HeroShowcase() {
  return (
    <section className="hx" aria-labelledby="home-hero-title">
      <div className="hx-media" aria-hidden="true">
        <Image
          src="/images/home/celebritypersona-hero-v2.png"
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
