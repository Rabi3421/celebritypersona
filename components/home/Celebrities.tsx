import { BlankFrame } from "@/components/site/Thumb";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { revealClass } from "@/lib/reveal";
import { nameSlug } from "@/lib/slugs";
import { celebrityTiles } from "@/lib/archive";
import { getOutfits } from "@/lib/db/content";

/** The most-decoded archives, counted off the outfits rather than a list an
 *  editor kept in step by hand. */
export async function Celebrities() {
  const tiles = celebrityTiles(await getOutfits());
  if (tiles.length === 0) return null;

  return (
    <section className="sec">
      <SectionHeading
        eyebrow="Archives"
        title="Style archives"
        blurb="Every look we've decoded, organised per person."
        moreLabel="A–Z index →"
        moreHref="/celebrities"
      />
      <div className="celebs">
        {tiles.map((celebrity, i) => (
          <Link
            href={`/celebrities/${nameSlug(celebrity.name)}`}
            className={`ctile ${revealClass(i)}`}
            key={celebrity.name}
          >
            <div className="av">
              {celebrity.image ? (
                <Image
                  className="home-cover"
                  src={celebrity.image}
                  alt={`${celebrity.name} in a look decoded on CelebrityPersona`}
                  fill
                  sizes="(max-width: 620px) 28vw, 15vw"
                />
              ) : (
                <BlankFrame seed={celebrity.name} />
              )}
            </div>
            <strong>{celebrity.name}</strong>
            <span>
              {celebrity.looks} {celebrity.looks === 1 ? "look" : "looks"}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
