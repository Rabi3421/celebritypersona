import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { getTrendingSearches } from "@/lib/db/content";

export async function Trending() {
  const trendingSearches = await getTrendingSearches();

  return (
    <section className="sec">
      <SectionHeading
        eyebrow="Right now"
        title="What people are searching"
        moreLabel="Full leaderboard →"
        moreHref="/trending"
      />
      <div className="tags rv rv-d1">
        {trendingSearches.map((search) => (
          <Link href={search.href} key={search.term}>
            {search.term} <b>{search.volume.toLocaleString("en-IN")}</b>
          </Link>
        ))}
      </div>
    </section>
  );
}
