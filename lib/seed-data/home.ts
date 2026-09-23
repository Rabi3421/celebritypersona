/**
 * Seed source for the single `home` site-content document. Not read by the app.
 *
 * Only what a person writes. Every figure the homepage shows — the stats bar,
 * the ticker, the budget tiers, the occasion and archive tiles, the brand
 * marquee, the dupe pick and the swap demo's pieces — is counted from the
 * outfits collection at render time.
 *
 * There used to be a `reels` list here too, six captions each with a view
 * count typed beside it ("142k", "Alia ka Rs 4.4 lakh look"), describing reels
 * that did not exist. The strip reads the account's real posts now, mirrored
 * by `npm run instagram:mirror`, so there is nothing for an editor to type.
 */
import type { HomeContent } from "@/lib/types";

export const homeContent: HomeContent = {
  swapSteps: [
    {
      n: "01",
      title: "We identify every piece",
      body: "By hand, not scraped. Brand, item, exact product page.",
    },
    {
      n: "02",
      title: "We find the closest swap",
      body: "Across Myntra, Ajio, Nykaa and more — matched on cut and fabric, not just colour.",
    },
    {
      n: "03",
      title: "We show when links were checked",
      body: "Every look carries its verification date. Sold out and missing links are labelled clearly.",
    },
  ],
  trustPoints: [
    {
      n: "01",
      title: "A person, not a scraper",
      body: "Every piece is identified by hand. If we can't confirm a brand, we mark it unidentified rather than guess.",
    },
    {
      n: "02",
      title: "Freshness shown on every look",
      body: "Each outfit page shows when its prices were last verified. If review is due, you'll see that too.",
    },
    {
      n: "03",
      title: "Dead links removed",
      body: "We test every link. Sold out is labelled sold out — we don't send you to an empty page.",
    },
    {
      n: "04",
      title: "Swaps are labelled swaps",
      body: "A lookalike is never presented as the real piece. You always know which one you're buying.",
    },
  ],
  // The look count in front of `body` is filled in from the archive.
  campaign: {
    eyebrow: "Wedding season",
    title: "Six weeks to the shaadi. Zero panic.",
    body: "decoded across sangeet, mehendi and reception — with swaps you can actually order in time for the date.",
    cta: "Open the wedding edit →",
    href: "/occasions",
  },
};
