/**
 * Seed source for the `trendingSearches` collection. Not read by the app.
 *
 * The ten rows that used to be here were invented questions with invented
 * answers: a Rs 4,43,500 airport look rebuilding for Rs 5,489 under Alia
 * Bhatt's name, "nine decoded sangeet looks" against none, Rs 22,000 juttis
 * swapping to Rs 400. They shipped to production and stayed live.
 *
 * The leaderboard is an editor's list of what readers actually ask, so the
 * rows belong in the panel rather than in a seed file — and their answers are
 * no longer stored at all. lib/trending-answers.ts computes each one from the
 * looks the term actually finds at render time, so a row can only say what the
 * archive can support. See lib/db/content.ts, getTrendingRows().
 */
import type { TrendingSearch } from "@/lib/types";

export const trendingSearches: TrendingSearch[] = [];

export const trendingFaqs = [
  {
    q: "How do you decide what is trending?",
    a: "The leaderboard is an editor-maintained ranking of the questions readers ask us most; this site does not claim measured search volume. The sections below it are computed from the decoded outfit archive.",
  },
  {
    q: "What is a dupe, exactly?",
    a: "A separate product that matches the original on cut, fabric and silhouette, sold by a retailer you can order from. It is never the same item and we never present it as one. Every swap on this site is labelled as a swap.",
  },
  {
    q: "Are the prices on this page current?",
    a: "Every outfit page shows its exact verification date and warns when a recheck is due. Retailers change prices without warning, so always confirm the current figure on the retailer page.",
  },
  {
    q: "Can I find a full celebrity look under ₹5,000?",
    // Answered from the archive at read time — see underBudgetAnswer() in
    // lib/db/content.ts. This text is the fallback, and it promises nothing
    // a count could contradict.
    a: "Sometimes. A complete look only counts once every piece in it has an alternative we have found and priced. Sort the archive by budget to see exactly which ones rebuild under ₹5,000 today, rather than taking our word for how common it is.",
  },
];
