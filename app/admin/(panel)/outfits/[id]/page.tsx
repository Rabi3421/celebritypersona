import { notFound } from "next/navigation";
import { OutfitForm } from "@/components/admin/OutfitForm";
import { getOccasionViews, getOutfits } from "@/lib/db/content";

export default async function EditOutfitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // The merged view, so an occasion invented on an earlier outfit is offered
  // here too rather than having to be typed identically a second time.
  const [outfits, occasions] = await Promise.all([getOutfits(), getOccasionViews()]);
  const outfit = outfits.find((item) => String(item.id) === id);
  if (!outfit) notFound();

  return (
    <OutfitForm
      outfit={outfit}
      occasions={occasions.map((occasion) => occasion.name)}
    />
  );
}
