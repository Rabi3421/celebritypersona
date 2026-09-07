import { OutfitForm } from "@/components/admin/OutfitForm";
import { getOccasionViews } from "@/lib/db/content";

export default async function NewOutfitPage() {
  // The merged view, so an occasion invented on an earlier outfit is offered
  // here too rather than having to be typed identically a second time.
  const occasions = await getOccasionViews();
  return <OutfitForm occasions={occasions.map((occasion) => occasion.name)} />;
}
