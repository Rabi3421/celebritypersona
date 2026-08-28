import { SectionHeading } from "./SectionHeading";
import { trendingSearches } from "@/lib/home-content";

export function Trending() {
  return (
    <section className="sec">
      <SectionHeading eyebrow="Right now" title="What people are searching" />
      <div className="tags rv rv-d1">
        {trendingSearches.map((search) => (
          <a href="#" key={search.term}>
            {search.term} <b>{search.count}</b>
          </a>
        ))}
      </div>
    </section>
  );
}
