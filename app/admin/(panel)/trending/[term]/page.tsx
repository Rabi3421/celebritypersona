import { notFound } from "next/navigation";
import { TrendingForm } from "@/components/admin/TrendingForm";
import { getTrendingSearches } from "@/lib/db/content";

export default async function EditTrendingPage({
  params,
}: {
  params: Promise<{ term: string }>;
}) {
  const { term } = await params;
  const search = (await getTrendingSearches()).find(
    (item) => item.term === decodeURIComponent(term),
  );
  if (!search) notFound();
  return <TrendingForm search={search} />;
}
