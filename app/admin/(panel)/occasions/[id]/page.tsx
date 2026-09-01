import { notFound } from "next/navigation";
import { OccasionForm } from "@/components/admin/OccasionForm";
import { getOccasionViews } from "@/lib/db/content";

export default async function EditOccasionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const occasion = (await getOccasionViews()).find((item) => String(item.id) === id);
  if (!occasion) notFound();
  return <OccasionForm occasion={occasion} />;
}
