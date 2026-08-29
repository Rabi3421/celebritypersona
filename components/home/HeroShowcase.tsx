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
          <p className="hx-kicker">
            <em aria-hidden="true" />
            Indian celebrity style, decoded
          </p>

          <h1 className="hx-title" id="home-hero-title">
            Know the look.
            <span>Find your version.</span>
          </h1>

          <p className="hx-lede">
            From airport arrivals to wedding season, discover what India&apos;s
            most-watched stars are wearing—and the ideas, labels, and looks that
            make their style your own.
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
