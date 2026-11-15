import { OutfitForm } from "@/components/admin/OutfitForm";
import { randomUUID } from "node:crypto";
import { getAllOutfits, getBrands, getCelebrities, getOccasions, getCelebrityViews, getOccasionViews } from "@/lib/db/content";
import { keywordOwners } from "@/lib/keyword-owners";
import { outfitSlug } from "@/lib/slugs";
import { buildSiteContext } from "@/lib/seo-review/site-context";

export default async function NewOutfitPage() {
  // The merged view, so an occasion invented on an earlier outfit is offered
  // here too rather than having to be typed identically a second time.
  const [occasions, outfits, celebrities, brands, celebrityRecords, occasionRecords] = await Promise.all([
    getOccasionViews(), getAllOutfits(), getCelebrityViews(), getBrands(), getCelebrities(), getOccasions(),
  ]);
  return (
    <OutfitForm
      createToken={randomUUID()}
      importCatalog={{
        outfits: outfits.map(({ id, celebrity, event, date, slug, items, researchImport }) => ({ id, celebrity, event, date, slug, items, ...(researchImport ? { researchImport: { instagramUrl: researchImport.instagramUrl, productUrl: researchImport.productUrl } } : {}) })),
        // Views can contain virtual hubs with no database record. Approval must name
        // every actual insert, including an existing outfit's virtual occasion.
        celebrities: celebrityRecords.map(({ name }) => ({ name })),
        occasions: occasionRecords.map(({ name }) => ({ name })),
        brands: brands.map(({ name }) => ({ name })),
      }}
      occasions={occasions.map((occasion) => occasion.name)}
      // Every slug already in use, so a suggestion can never propose one that
      // would collide with a live URL.
      takenSlugs={outfits.map(outfitSlug)}
      owners={keywordOwners(outfits)}
      // A prepared look can be typed in here and reviewed without being saved.
      seoContext={buildSiteContext({ outfits, celebrities, occasions })}
    />
  );
}
