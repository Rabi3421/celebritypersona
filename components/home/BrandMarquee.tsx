import { brands } from "@/lib/home-content";

export function BrandMarquee() {
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
