import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { revealClass } from "@/lib/reveal";
import { nameSlug } from "@/lib/slugs";
import { occasionTiles } from "@/lib/archive";
import { getOutfits } from "@/lib/db/content";

/** Ranked by how many looks the archive actually holds for each event, and
 *  illustrated with the newest photo from that group. */
export async function Occasions() {
  const tiles = occasionTiles(await getOutfits());
  if (tiles.length === 0) return null;

  return (
    <section className="sec">
      <SectionHeading
        eyebrow="Browse"
        title="By occasion"
        blurb="Wedding in six weeks? Start here."
        moreLabel="All occasions →"
        moreHref="/occasions"
      />
      <div className="occ">
        {tiles.map((occasion, i) => (
          <Link
            href={`/occasions/${nameSlug(occasion.name)}`}
            className={`otile ${revealClass(i, 4)}`}
            key={occasion.name}
          >
            <Image
              className="home-cover"
              src={occasion.image ?? `https://picsum.photos/seed/cp-occasion-${i + 1}/600/800`}
              alt={`${occasion.name} outfit decoded on CelebrityPersona`}
              fill
              sizes="(max-width: 620px) 50vw, 25vw"
            />
            <div className="lab">
              <strong>{occasion.name}</strong>
              <span>
                {occasion.looks} {occasion.looks === 1 ? "look" : "looks"}
              </span>
              <p className="go">View →</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
