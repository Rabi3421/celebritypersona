import { HomeForm } from "@/components/admin/HomeForm";
import { getHomeContent } from "@/lib/db/content";

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const [home, { saved }] = await Promise.all([getHomeContent(), searchParams]);
  return <HomeForm home={home} saved={saved === "1"} />;
}
