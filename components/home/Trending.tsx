import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { getPublicTrendingRows } from "@/lib/db/content";

export async function Trending() {
  // Only rows the archive answers, and only once there are enough of them.
  // Empty means the band is not published at all.
  const trendingSearches = await getPublicTrendingRows();
  if (trendingSearches.length === 0) return null;

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
