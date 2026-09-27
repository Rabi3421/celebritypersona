import Link from "next/link";
import { brandRoll } from "@/lib/archive";
import { getPublishedOutfits } from "@/lib/db/content";
import { nameSlug } from "@/lib/slugs";

/** The labels worn in the archive and the shops we swap them for, interleaved.
 *  Was a list typed into the homepage form. */
export async function BrandMarquee() {
  const brands = brandRoll(await getPublishedOutfits());
  if (brands.length === 0) return null;

  // The strip is drawn twice so the scroll can loop. The first copy is the
  // real list of links; the second only fills the loop, so it is hidden from
  // screen readers and skipped by the keyboard.
  const copy = (hidden: boolean) =>
    brands.map((brand) => (
      <Link
        href={`/brands/${nameSlug(brand)}`}
        key={`${brand}-${hidden}`}
        {...(hidden ? { "aria-hidden": true, tabIndex: -1 } : {})}
      >
        {brand}
      </Link>
    ));

  return (
    <nav className="bmq" aria-label="Brands in the archive">
      <div className="bmq-track">
        {copy(false)}
        {copy(true)}
      </div>
    </nav>
  );
}
