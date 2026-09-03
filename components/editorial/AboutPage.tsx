import Link from "next/link";
import { DetailRow } from "./Pending";
import { contacts, legalEntity, site } from "@/lib/site-config";
import styles from "./editorial.module.css";
import { getOutfits } from "@/lib/db/content";
import { inr } from "@/lib/format";
import { hasSwap, hasWornPrice, type Outfit } from "@/lib/types";

/** The single piece in the archive with the widest gap between what she wore
 *  and what it can be rebuilt for — the clearest example the site has. */
function widestGap(outfits: Outfit[]) {
  const pieces = outfits.flatMap((outfit) =>
    outfit.items
      .filter((item) => hasSwap(item) && hasWornPrice(item))
      .map((item) => ({
        celebrity: outfit.celebrity,
        piece: item.name,
        wornBrand: item.wornBrand,
        worn: item.worn as number,
        swapBrand: item.swapBrand as string,
        swap: item.swap as number,
      })),
  );
  if (!pieces.length) return null;
  return pieces.reduce((widest, piece) =>
    piece.worn - piece.swap > widest.worn - widest.swap ? piece : widest,
  );
}

export async function AboutPage() {
  const outfits = await getOutfits();
  // The two cards below used to quote a Bottega Veneta tote at ₹2,85,000
  // against a ₹1,499 Lino Perros one — figures typed into this file to
  // illustrate the idea, on a page whose whole subject is not making numbers
  // up. They now come from a look that has actually been decoded, and say
  // nothing at all when none has.
  const example = widestGap(outfits);

  return (
    <main className={styles.page}>
      <header className={styles.band}>
        <div className={styles.shell}>
          <nav className={styles.crumb}>
            <Link href="/">Home</Link>
            <i>›</i>
            <span>Who we are</span>
          </nav>
          <p className={styles.eyebrow}>About</p>
          <h1>&ldquo;She wore Sabyasachi&rdquo; is not shopping advice</h1>
          <p className={styles.lede}>
            Indian fashion media is very good at telling you what a celebrity
            spent. It almost never tells you what you could spend. We built the
            second half.
          </p>
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.section}>
          <div className={styles.heading}>
            <p>The gap</p>
            <h2>Everyone stops at the price tag</h2>
            <span>
              Read any celebrity fashion story in India and you will find the
              same shape: the name, the garment, the number, the end. It is a
              fun fact. It is not a decision you can act on.
            </span>
          </div>
          <div className={styles.contrast}>
            <div className={`${styles.contrastCard} ${styles.them}`}>
              <h3>What you usually get</h3>
              <q>
                {example
                  ? `${example.celebrity} carries a ${inr(example.worn)} ${example.piece.toLowerCase()}`
                  : "Actress carries a six-figure tote to the airport"}
              </q>
              <p>
                Accurate, well photographed, and completely useless if you were
                hoping to dress like that on a salary. There is nothing to do
                with this except feel poorer.
              </p>
            </div>
            <div className={`${styles.contrastCard} ${styles.us}`}>
              <h3>What we publish instead</h3>
              <q>
                {example
                  ? `That ${example.piece.toLowerCase()} is ${example.wornBrand} at ${inr(example.worn)}. This ${example.swapBrand} one is ${inr(example.swap)} and the shape is the same.`
                  : "The exact label, the exact price, and the closest thing you can actually buy — named, priced and linked."}
              </q>
              <p>
                Every piece named, every original priced, every swap linked to a
                shop that will actually deliver to your pin code.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.heading}>
            <p>What we do</p>
            <h2>Every look decoded twice</h2>
          </div>
          <div className={styles.steps}>
            <div className={styles.step}>
              <b>01</b>
              <div>
                <h3>Identify</h3>
                <p>
                  A person looks at the photograph and works out what each piece
                  is. Brand, item, the specific product where we can find it. Not
                  a scraper, not a guess. Where we cannot confirm something we
                  label it unidentified and leave it there.
                </p>
              </div>
            </div>
            <div className={styles.step}>
              <b>02</b>
              <div>
                <h3>Price</h3>
                <p>
                  We record what the original costs, from the brand&apos;s own
                  listing wherever one exists. That is the number the rest of the
                  internet stops at.
                </p>
              </div>
            </div>
            <div className={styles.step}>
              <b>03</b>
              <div>
                <h3>Swap</h3>
                <p>
                  Then the work everyone skips. We hunt for the closest thing you
                  can actually buy, matched on cut, fabric and silhouette rather
                  than colour alone, across Myntra, Ajio, Nykaa Fashion and the
                  rest. It is labelled a swap because that is what it is.
                </p>
              </div>
            </div>
          </div>
          <p className={styles.prose} style={{ marginTop: "var(--s6)" }}>
            <Link href="/how-we-work">The full method is written up here →</Link>
          </p>
        </section>

        <section className={styles.section}>
          <div className={styles.heading}>
            <p>Money</p>
            <h2>How this is paid for</h2>
            <span>
              A site that lectures people about honest pricing cannot be vague
              about its own.
            </span>
          </div>
          <div className={styles.prose}>
            <p>
              We earn a commission on some outbound links. If you buy through
              one, the retailer pays us a percentage out of their margin.{" "}
              <strong>You pay exactly the same price either way.</strong>
            </p>
            <p>
              What that commission does not buy is the pick. A swap is chosen
              because it is the closest match we could find, and we link to
              retailers we earn nothing from whenever they have the better
              option. No brand can pay to be named as a swap or to be taken out
              of a comparison.
            </p>
            <p>
              <Link href="/affiliate-disclosure">
                The full affiliate disclosure →
              </Link>
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.heading}>
            <p>Standards</p>
            <h2>What we hold ourselves to</h2>
          </div>
          <div className={styles.cards}>
            <Link href="/how-we-work" className={styles.card}>
              <span>Method</span>
              <h3>How we work</h3>
              <p>
                The decode process end to end, what we verify, how often, and the
                things we refuse to do.
              </p>
              <em>Read the method →</em>
            </Link>
            <Link href="/corrections" className={styles.card}>
              <span>Accuracy</span>
              <h3>Corrections</h3>
              <p>
                We get things wrong. When we do, we fix it in the open and say
                what changed rather than editing quietly.
              </p>
              <em>Corrections policy →</em>
            </Link>
            <Link href="/photo-credits" className={styles.card}>
              <span>Imagery</span>
              <h3>Photo credits</h3>
              <p>
                Where the photographs come from, and the line between reporting
                an outfit and implying an endorsement.
              </p>
              <em>Photo policy →</em>
            </Link>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.callout}>
            <h2>Who is behind this</h2>
            <p>
              {site.name} is published from India and has decoded{" "}
              {outfits.length} looks so far. If you want to know who did a
              particular decode, ask and we will tell you.
            </p>
            <dl className={styles.calloutRows}>
              <DetailRow label="Published by" value={legalEntity.name} />
              <DetailRow label="Based in" value={legalEntity.address} />
              <div>
                <dt>Editorial</dt>
                <dd>{contacts.editorial}</dd>
              </div>
              <div>
                <dt>Everything else</dt>
                <dd>{contacts.general}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </main>
  );
}
