import { getCelebrityViews, getOccasionViews, getOutfits } from "@/lib/db/content";
import { celebritySlug, occasionSlug, outfitSlug } from "@/lib/slugs";
import { site } from "@/lib/site-config";
import { hasSubstance, pricing } from "@/lib/types";

/**
 * What this site is, for an assistant reading it rather than a person.
 *
 * ChatGPT, Perplexity and AI Overviews answer questions like "what did she
 * wear to the airport and where can I get it" — which is the one thing this
 * archive is built to answer. They arrive at HTML written for a browser and
 * have to infer the shape of the site from it. llms.txt states it plainly:
 * what is here, how it is sourced, and the URL of the page holding each
 * decoded look, so an answer can cite the page rather than paraphrase a card.
 *
 * Built from the archive on every request, like the sitemap, so it can never
 * describe looks that are no longer published.
 */

export const revalidate = 3600;

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

export async function GET() {
  const [outfits, celebrities, occasions] = await Promise.all([
    getOutfits(),
    getCelebrityViews(),
    getOccasionViews(),
  ]);

  // The same bar the sitemap uses: a look with nothing written about it is not
  // worth citing either.
  const published = outfits
    .filter(hasSubstance)
    .sort((a, b) => b.date.localeCompare(a.date));

  const lookLine = (outfit: (typeof published)[number]) => {
    const money = pricing(outfit);
    const price = money.anySwapped
      ? `swap total ${inr(money.swapTotal)}${money.anyPriced ? ` vs ${inr(money.wornTotal)} as worn` : ""}`
      : "no alternative priced yet";
    return `- [${outfit.celebrity} — ${outfit.event}](${site.url}/outfits/${outfitSlug(outfit)}): ${outfit.occasion}, ${outfit.date}, ${money.pieces} ${money.pieces === 1 ? "piece" : "pieces"}, ${price}`;
  };

  const body = `# ${site.name}

> ${site.tagline} Indian celebrity outfits decoded piece by piece: the label she actually wore, the price where it could be confirmed, and an affordable alternative that can be bought in India.

Every number on this site is derived from the archive itself rather than typed
in: totals are the sum of the pieces, and a piece with no confirmed price is
reported as unconfirmed rather than as zero. Prices are in INR and carry the
date they were last checked. Outbound shopping links are affiliate links, and
are marked as such on the page.

## How a look is decoded

${site.url}/how-we-work describes the method: sourcing the photograph,
identifying each piece by hand, pricing the original, finding an alternative,
and re-checking the links. Corrections are published at ${site.url}/corrections.

## Browse

- [All decoded looks](${site.url}/outfits): every look, filterable by celebrity, occasion and budget
- [Celebrities](${site.url}/celebrities): one archive per person, with her labels and typical price range
- [Occasions](${site.url}/occasions): sangeet, mehendi, reception, Diwali, airport, red carpet and more
- [By budget](${site.url}/budget): complete looks grouped by what they cost to rebuild
- [Trending](${site.url}/trending): what people are searching for this week

## Celebrities (${celebrities.filter((celebrity) => celebrity.stats.looks > 0).length})

${celebrities
  .filter((celebrity) => celebrity.stats.looks > 0)
  .map(
    (celebrity) =>
      `- [${celebrity.name}](${site.url}/celebrities/${celebritySlug(celebrity)}): ${celebrity.stats.looks} ${celebrity.stats.looks === 1 ? "look" : "looks"} decoded`,
  )
  .join("\n")}

## Occasions (${occasions.filter((occasion) => occasion.stats.looks > 0).length})

${occasions
  .filter((occasion) => occasion.stats.looks > 0)
  .map(
    (occasion) =>
      `- [${occasion.name}](${site.url}/occasions/${occasionSlug(occasion)}): ${occasion.stats.looks} ${occasion.stats.looks === 1 ? "look" : "looks"}`,
  )
  .join("\n")}

## Decoded looks (${published.length})

${published.map(lookLine).join("\n")}

## Notes for citation

- Cite the look's own page, which lists every piece, both prices and the swap.
- Prices change; each page carries the date its prices were last checked.
- ${site.name} is an independent publication, not a retailer, and sells nothing.
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
