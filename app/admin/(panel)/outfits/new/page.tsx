import { OutfitForm } from "@/components/admin/OutfitForm";
import { getAllOutfits, getOccasionViews } from "@/lib/db/content";
import { outfitSlug } from "@/lib/slugs";

export default async function NewOutfitPage() {
  // The merged view, so an occasion invented on an earlier outfit is offered
  // here too rather than having to be typed identically a second time.
  const [occasions, outfits] = await Promise.all([getOccasionViews(), getAllOutfits()]);
  return (
    <OutfitForm
      occasions={occasions.map((occasion) => occasion.name)}
      // Every slug already in use, so a suggestion can never propose one that
      // would collide with a live URL.
      takenSlugs={outfits.map(outfitSlug)}
    />
  );
}
