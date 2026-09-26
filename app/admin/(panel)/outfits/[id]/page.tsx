import { notFound } from "next/navigation";
import { OutfitForm } from "@/components/admin/OutfitForm";
import { getOccasionViews, getAllOutfits } from "@/lib/db/content";
import { keywordOwners } from "@/lib/keyword-owners";
import { outfitSlug } from "@/lib/slugs";

export default async function EditOutfitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // The merged view, so an occasion invented on an earlier outfit is offered
  // here too rather than having to be typed identically a second time.
  const [outfits, occasions] = await Promise.all([getAllOutfits(), getOccasionViews()]);
  const outfit = outfits.find((item) => String(item.id) === id);
  if (!outfit) notFound();

  return (
    <OutfitForm
      outfit={outfit}
      occasions={occasions.map((occasion) => occasion.name)}
      takenSlugs={outfits.filter((item) => item.id !== outfit.id).map(outfitSlug)}
      owners={keywordOwners(outfits)}
    />
  );
}
