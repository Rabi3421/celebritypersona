import type { CSSProperties } from "react";
import type { Outfit } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import { nameSlug, outfitSlug } from "@/lib/slugs";
import {
  getOutfits,
  getTrendingFaqs,
  getTrendingSearches,
} from "@/lib/db/content";
import { biggestSavers, freshestLooks, savingPercent, trendingBrands, trendingDupes, trendingOccasions } from "@/lib/trending";
import styles from "@/app/trending/trending.module.css";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export async function TrendingBoard() {
  const [outfits, trendingSearches, trendingFaqs] = await Promise.all([
    getOutfits(),
    getTrendingSearches(),
    getTrendingFaqs(),
  ]);

  const totalSearches = trendingSearches.reduce((sum, item) => sum + item.volume, 0);
  const topVolume = Math.max(...trendingSearches.map((item) => item.volume));
  const fastestRiser = [...trendingSearches].sort((a, b) => b.changePct - a.changePct)[0];
  const cheapestLook = Math.min(...outfits.map((outfit) => outfit.swap));

  return (
    <main className={styles.page}>
      <header className={styles.band}>
        <div className={styles.shell}>
          <nav className={styles.crumb}>
            <Link href="/">Home</Link>
            <i>›</i>
            <span>Trending</span>
          </nav>
          <h1>
            What India is searching
            <br />
            for right now
          </h1>
          <p className={styles.lede}>
            The ten most-searched looks on this site this week, each one answered
            with the piece, the brand and the price you would actually pay. Every
            other site publishes the number she spent and stops there.
          </p>
          <div className={styles.pulse}>
            <div>
              <span>Searches this week</span>
              <b>{totalSearches.toLocaleString("en-IN")}</b>
            </div>
            <div>
              <span>Fastest riser</span>
              <b>
                +{fastestRiser.changePct}
                <em>%</em>
              </b>
            </div>
            <div>
              <span>Looks in the archive</span>
              <b>{outfits.length}</b>
            </div>
            <div>
              <span>Cheapest complete look</span>
              <b>{inr.format(cheapestLook)}</b>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.board}>
        <div className={styles.shell}>
          <div className={styles.boardHeading}>
            <span>◆ Top searches · last 7 days</span>
            <i />
            <small>On-site search, not scraped</small>
          </div>
          {trendingSearches.map((search, index) => (
            <Link href={search.href} className={styles.row} key={search.term}>
              <i className={styles.rank}>{String(index + 1).padStart(2, "0")}</i>
              <span className={styles.term}>{search.term}</span>
              <span className={styles.intent}>{search.intent}</span>
              <span className={styles.metric}>
                <span className={styles.bar}>
                  <i
                    style={
                      { "--fill": `${(search.volume / topVolume) * 100}%` } as CSSProperties
                    }
                  />
                </span>
                <b className={styles.change}>+{search.changePct}%</b>
              </span>
              <span className={styles.answer}>{search.answer}</span>
              <i className={styles.arrow}>→</i>
            </Link>
          ))}
        </div>
      </section>

      <div className={styles.shell}>
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <p>Just decoded</p>
              <h2>Trending looks this week</h2>
              <span>
                The eight most recent decodes, newest first. Each one is priced
                twice, once as she wore it and once as you can order it.
              </span>
            </div>
            <Link href="/outfits">All outfits →</Link>
          </div>
          <div className={styles.looks}>
            {freshestLooks(outfits).map((outfit) => (
              <LookCard outfit={outfit} key={outfit.id} />
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <p>Dupes</p>
              <h2>Biggest price gaps right now</h2>
              <span>
                Single pieces where the distance between the original and the
                swap is widest. This is the search people usually mean when they
                type the word dupe.
              </span>
            </div>
            <Link href="/budget">Shop by budget →</Link>
          </div>
          <div className={styles.dupes}>
            {trendingDupes(outfits).map((dupe) => (
              <Link
                href={`/outfits/${dupe.slug}`}
                className={styles.dupe}
                key={`${dupe.celebrity}-${dupe.name}-${dupe.worn}`}
              >
                <span>{dupe.celebrity}</span>
                <h3>{dupe.name}</h3>
                <p className={styles.dupeSwap}>
                  <s>{dupe.wornBrand}</s>
                  <i>→</i>
                  <b>{dupe.swapBrand}</b>
                </p>
                <p className={styles.dupeGap}>
                  <span>
                    {inr.format(dupe.worn)} → {inr.format(dupe.swap)}
                  </span>
                  <b>{Math.floor(((dupe.worn - dupe.swap) / dupe.worn) * 100)}% less</b>
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.split}>
            <div>
              <div className={styles.sectionHeading}>
                <div>
                  <p>Retailers</p>
                  <h2>Where the swaps come from</h2>
                  <span>
                    The shops our swaps point at most often across the archive.
                  </span>
                </div>
              </div>
              <div className={styles.list}>
                {trendingBrands(outfits).map((brand, index) => (
                  <div className={styles.listRow} key={brand.name}>
                    <i>{String(index + 1).padStart(2, "0")}</i>
                    <strong>{brand.name}</strong>
                    <span>{brand.swaps} swaps</span>
                    <b>from {inr.format(brand.cheapest)}</b>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className={styles.sectionHeading}>
                <div>
                  <p>Occasions</p>
                  <h2>What people are dressing for</h2>
                  <span>
                    Ranked by how many looks the archive holds for each event.
                  </span>
                </div>
              </div>
              <div className={styles.list}>
                {trendingOccasions(outfits).map((occasion, index) => (
                  <Link
                    href={`/occasions/${nameSlug(occasion.name)}`}
                    className={styles.listRow}
                    key={occasion.name}
                  >
                    <i>{String(index + 1).padStart(2, "0")}</i>
                    <strong>{occasion.name}</strong>
                    <span>{occasion.looks} looks</span>
                    <b>from {inr.format(occasion.cheapest)}</b>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <p>The widest gaps</p>
              <h2>Most saved this week</h2>
              <span>
                Complete looks ranked by the rupee distance between the original
                and the rebuild.
              </span>
            </div>
            <Link href="/celebrities">Style archives →</Link>
          </div>
          <div className={styles.looks}>
            {biggestSavers(outfits).slice(0, 4).map((outfit) => (
              <LookCard outfit={outfit} key={outfit.id} />
            ))}
          </div>
        </section>

        <section className={styles.method}>
          <h2>How we decide what is trending</h2>
          <p>
            Trending is a claim, so here is the working behind it. No scraped
            rankings, no borrowed charts, no numbers we cannot show you the
            source of.
          </p>
          <div className={styles.methodGrid}>
            <div>
              <span>01</span>
              <strong>Our own search box</strong>
              <p>
                The leaderboard is what visitors typed into this site over the
                last seven days, ranked by count. It is not third-party keyword
                data and we do not present it as national search volume.
              </p>
            </div>
            <div>
              <span>02</span>
              <strong>Computed from the archive</strong>
              <p>
                Every look, dupe, retailer and occasion below the leaderboard is
                calculated from the decoded outfits themselves. A piece cannot
                trend here until a person has identified it and checked it.
              </p>
            </div>
            <div>
              <span>03</span>
              <strong>Re-checked weekly</strong>
              <p>
                Prices move and stock runs out. Every outfit page carries the
                date its prices were last verified, and sold out is labelled
                rather than quietly left up.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.faq}>
          <div className={styles.sectionHeading}>
            <div>
              <p>Before you ask</p>
              <h2>Questions people ask</h2>
            </div>
          </div>
          <div className={styles.faqList}>
            {trendingFaqs.map((faq) => (
              <details className={styles.faqItem} key={faq.q}>
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function LookCard({ outfit }: { outfit: Outfit }) {
  return (
    <article className={styles.look}>
      <Link href={`/outfits/${outfitSlug(outfit)}`}>
        <div className={styles.lookImage}>
          <Image
            src={`https://picsum.photos/seed/cpo${outfit.id}/600/750`}
            alt={`${outfit.celebrity} at ${outfit.event}`}
            fill
            sizes="(max-width:520px) 100vw, (max-width:1023px) 50vw, 25vw"
          />
          <span>{outfit.occasion}</span>
          <em>{savingPercent(outfit)}% less</em>
        </div>
        <div className={styles.lookBody}>
          <h3>{outfit.celebrity}</h3>
          <p>{outfit.event}</p>
          <p className={styles.lookPrice}>
            <s>{inr.format(outfit.worn)}</s>
            <b>{inr.format(outfit.swap)}</b>
          </p>
        </div>
      </Link>
    </article>
  );
}
