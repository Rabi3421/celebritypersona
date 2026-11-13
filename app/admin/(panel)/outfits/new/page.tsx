import { OutfitForm } from "@/components/admin/OutfitForm";
import { getAllOutfits, getCelebrityViews, getOccasionViews } from "@/lib/db/content";
import { keywordOwners } from "@/lib/keyword-owners";
import { outfitSlug } from "@/lib/slugs";
import { buildSiteContext } from "@/lib/seo-review/site-context";

export default async function NewOutfitPage() {
  // The merged view, so an occasion invented on an earlier outfit is offered
  // here too rather than having to be typed identically a second time.
  const [occasions, outfits, celebrities] = await Promise.all([getOccasionViews(), getAllOutfits(), getCelebrityViews()]);
  return (
    <OutfitForm
      occasions={occasions.map((occasion) => occasion.name)}
      // Every slug already in use, so a suggestion can never propose one that
      // would collide with a live URL.
      takenSlugs={outfits.map(outfitSlug)}
      owners={keywordOwners(outfits)}
      // A prepared look can be typed in here and reviewed without being saved.
      seoContext={buildSiteContext({ outfits, celebrities, occasions })}
    />
  );
}
