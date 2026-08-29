import { notFound } from "next/navigation";
import { OutfitForm } from "@/components/admin/OutfitForm";
import { getOccasions, getOutfits } from "@/lib/db/content";

export default async function EditOutfitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [outfits, occasions] = await Promise.all([getOutfits(), getOccasions()]);
  const outfit = outfits.find((item) => String(item.id) === id);
  if (!outfit) notFound();

  return (
    <OutfitForm
      outfit={outfit}
      occasions={occasions.map((occasion) => occasion.name)}
    />
  );
}
