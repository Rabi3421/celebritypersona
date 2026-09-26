import Link from "next/link";
import { CardPrice, cardPriceValues } from "@/components/site/CardPrice";
import { OutfitThumb } from "@/components/site/Thumb";
import { headline } from "@/lib/outfit-seo";
import { outfitSlug } from "@/lib/slugs";
import type { Outfit } from "@/lib/types";
import styles from "./hub.module.css";

/** A heading and a grid of look cards, for the brand and budget pages. */
export function HubLooks({ title, outfits }: { title: string; outfits: Outfit[] }) {
  if (!outfits.length) return null;
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      <div className={styles.grid}>
        {outfits.map((outfit) => (
          <Link className={styles.card} href={`/outfits/${outfitSlug(outfit)}`} key={outfit.id}>
            <div className={styles.thumb}>
              <OutfitThumb outfit={outfit} sizes="(max-width: 720px) 50vw, 240px" />
            </div>
            <div className={styles.body}>
              <h3>{headline(outfit)}</h3>
              <p>
                {outfit.celebrity} · {outfit.event}
              </p>
              <p className={styles.price}>
                <CardPrice {...cardPriceValues(outfit)} />
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** The page's own intro, as written in the admin. Nothing is generated here:
 *  an empty intro shows nothing rather than filler. */
export function HubIntro({ paragraphs }: { paragraphs?: string[] }) {
  if (!paragraphs?.length) return null;
  return (
    <div className={styles.intro}>
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  );
}
