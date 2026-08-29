import { OutfitForm } from "@/components/admin/OutfitForm";
import { getOccasions } from "@/lib/db/content";

export default async function NewOutfitPage() {
  const occasions = await getOccasions();
  return <OutfitForm occasions={occasions.map((occasion) => occasion.name)} />;
}
