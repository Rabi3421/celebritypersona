import { getHomeContent } from "@/lib/db/content";


export async function BrandMarquee() {
  const { brands } = await getHomeContent();

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
