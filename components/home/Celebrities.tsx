import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { revealClass } from "@/lib/reveal";
import { getHomeContent } from "@/lib/db/content";

export async function Celebrities() {
  const { celebrities } = await getHomeContent();

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
        {celebrities.map((celebrity, i) => (
          <Link
            href={`/celebrities/${celebrity.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            className={`ctile ${revealClass(i)}`}
            key={celebrity.name}
          >
            <div className="av">
              <Image
                className="home-cover"
                src={`https://picsum.photos/seed/cp-celebrity-${i + 1}/320/320`}
                alt={`Sample portrait for ${celebrity.name}'s style archive`}
                fill
                sizes="(max-width: 620px) 28vw, 15vw"
              />
            </div>
            <strong>{celebrity.name}</strong>
            <span>{celebrity.looks} looks</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
