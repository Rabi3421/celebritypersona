import { notFound } from "next/navigation";
import { HubRecordForm } from "@/components/admin/HubRecordForm";
import { getBrandViews } from "@/lib/db/content";
import { brandDescription, brandHeadline } from "@/lib/hub-pages";
import { nameSlug } from "@/lib/slugs";
import { saveBrand } from "../actions";

export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brand = (await getBrandViews()).find((item) => item.record && String(item.id) === id);
  if (!brand) notFound();

  return (
    <HubRecordForm
      action={saveBrand}
      hidden={{ id: brand.id }}
      record={brand}
      introHint={`One paragraph per line, 100–300 words on ${brand.name}: who wears it, what it is known for, where it is sold and what it costs. With fewer than 2 looks, the page stays out of Google until this has 100+ words.`}
      path={`/brands/${nameSlug(brand.name)}`}
      looks={brand.stats.looks}
      fallbackTitle={brandHeadline(brand)}
      fallbackDescription={brandDescription(brand)}
      backHref="/admin/brands"
    />
  );
}
