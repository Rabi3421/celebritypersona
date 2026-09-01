import { notFound } from "next/navigation";
import { CelebrityForm } from "@/components/admin/CelebrityForm";
import { getCelebrityViews } from "@/lib/db/content";

export default async function EditCelebrityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const celebrity = (await getCelebrityViews()).find((item) => String(item.id) === id);
  if (!celebrity) notFound();
  return <CelebrityForm celebrity={celebrity} />;
}
