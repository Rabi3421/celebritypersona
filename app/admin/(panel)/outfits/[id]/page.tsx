import Link from "next/link";
import { notFound } from "next/navigation";
import { OutfitForm } from "@/components/admin/OutfitForm";
import { getCelebrityViews, getOccasionViews, getAllOutfits } from "@/lib/db/content";
import { keywordOwners } from "@/lib/keyword-owners";
import { outfitSlug } from "@/lib/slugs";
import { buildSiteContext } from "@/lib/seo-review/site-context";
import styles from "@/app/admin/panel.module.css";

export default async function EditOutfitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // The merged view, so an occasion invented on an earlier outfit is offered
  // here too rather than having to be typed identically a second time.
  const [outfits, occasions, celebrities] = await Promise.all([getAllOutfits(), getOccasionViews(), getCelebrityViews()]);
  const outfit = outfits.find((item) => String(item.id) === id);
  if (!outfit) notFound();

  return (
    <>
      {/* A draft is finished on its review page; say so here, so nobody is left in the long form. */}
      {outfit.status === "draft" ? (
        <div className={styles.notice} role="status">
          <strong>This look is a draft.</strong>
          <p>
            Fix what you need here and press Save, then{" "}
            <Link href={`/admin/preview/${outfit.id}`}>go back to Review &amp; publish →</Link>
          </p>
        </div>
      ) : null}
    <OutfitForm
      outfit={outfit}
      occasions={occasions.map((occasion) => occasion.name)}
      takenSlugs={outfits.filter((item) => item.id !== outfit.id).map(outfitSlug)}
      owners={keywordOwners(outfits)}
      seoContext={buildSiteContext({ outfits, celebrities, occasions, self: outfit })}
    />
    </>
  );
}
