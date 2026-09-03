import { isFullySwapped, pricing, wornLabel } from "@/lib/types";
import type { Outfit } from "@/lib/types";
import Link from "next/link";
import { plural } from "@/lib/format";
import { OutfitThumb } from "@/components/site/Thumb";
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

  /**
   * `volume` and `changePct` are typed into the admin form. Nothing on this
   * site counts searches — there is no search log — so the page used to
   * publish "12,170 searches this week" and per-term counts that measured
   * nothing, under a methodology note claiming they came from the site's own
   * search box. Both are now left unrendered; the ordering, which is an
   * editor's ranking and honestly described as one, is kept.
   */
  const buyable = outfits.filter(isFullySwapped);
  const cheapestLook = buyable.length
    ? Math.min(...buyable.map((outfit) => pricing(outfit).swapTotal))
    : null;

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
            Trending celebrity
            <br />
            outfits right now
          </h1>
          <p className={styles.lede}>
            The looks people come here for, ranked by our editor, each one
            answered with the piece, the brand and the price you would actually
            pay. Every other site publishes the number she spent and stops
            there.
          </p>
          <div className={styles.pulse}>
            <div>
              <span>Looks in the archive</span>
              <b>{outfits.length}</b>
            </div>
            <div>
              <span>Complete looks you can copy</span>
              <b>{buyable.length}</b>
            </div>
            {cheapestLook === null ? null : (
              <div>
                <span>Cheapest complete look</span>
                <b>{inr.format(cheapestLook)}</b>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className={styles.board}>
        <div className={styles.shell}>
          <div className={styles.boardHeading}>
            <span>◆ What we are asked for most</span>
            <i />
            <small>Ranked by our editor</small>
          </div>
          {trendingSearches.map((search, index) => (
            <Link href={search.href} className={styles.row} key={search.term}>
              <i className={styles.rank}>{String(index + 1).padStart(2, "0")}</i>
              <span className={styles.term}>{search.term}</span>
              <span className={styles.intent}>{search.intent}</span>
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
                  <s>{wornLabel(dupe)}</s>
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
                    <span>{plural(brand.swaps, "swap")}</span>
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
                    <span>{plural(occasion.looks, "look")}</span>
                    <b>
                      {occasion.cheapest === null
                        ? "No swap yet"
                        : `from ${inr.format(occasion.cheapest)}`}
                    </b>
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
              <strong>An editor&apos;s ranking</strong>
              <p>
                The leaderboard is the questions we are asked most, ordered by
                the person who maintains this archive. It is not search-volume
                data, and we do not publish a number against it, because we do
                not measure one.
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
  const money = pricing(outfit);
  const cut = savingPercent(outfit);
  return (
    <article className={styles.look}>
      <Link href={`/outfits/${outfitSlug(outfit)}`}>
        <div className={styles.lookImage}>
          <OutfitThumb
            outfit={outfit}
            sizes="(max-width:520px) 100vw, (max-width:1023px) 50vw, 25vw"
          />
          <span>{outfit.occasion}</span>
          {cut === null ? null : <em>{cut}% less</em>}
        </div>
        <div className={styles.lookBody}>
          <h3>{outfit.celebrity}</h3>
          <p>{outfit.event}</p>
          <p className={styles.lookPrice}>
            {money.anyPriced ? <s>{inr.format(money.wornTotal)}</s> : <em>Price unconfirmed</em>}
            {money.anySwapped ? <b>{inr.format(money.swapTotal)}</b> : <em>No swap yet</em>}
          </p>
        </div>
      </Link>
    </article>
  );
}
