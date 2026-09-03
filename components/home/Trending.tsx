import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { getTrendingSearches } from "@/lib/db/content";

export async function Trending() {
  const trendingSearches = await getTrendingSearches();

  return (
    <section className="sec">
      <SectionHeading
        eyebrow="Right now"
        title="What people ask us for"
        moreLabel="Full leaderboard →"
        moreHref="/trending"
      />
      <div className="tags rv rv-d1">
        {trendingSearches.map((search) => (
          <Link href={search.href} key={search.term}>
            {/* `volume` is a number typed into the admin form, not a
                measurement; it is no longer published as one. */}
            {search.term} <b aria-hidden="true">→</b>
          </Link>
        ))}
      </div>
    </section>
  );
}
