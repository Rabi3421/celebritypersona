import { brandRoll } from "@/lib/archive";
import { getOutfits } from "@/lib/db/content";

/** The labels worn in the archive and the shops we swap them for, interleaved.
 *  Was a list typed into the homepage form. */
export async function BrandMarquee() {
  const brands = brandRoll(await getOutfits());
  if (brands.length === 0) return null;

  const loop = [...brands, ...brands];

  return (
    <div className="bmq" aria-hidden="true">
      <div className="bmq-track">
        {loop.map((brand, i) => (
          <span key={`${brand}-${i}`}>{brand}</span>
        ))}
      </div>
    </div>
  );
}
