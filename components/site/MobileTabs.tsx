import Link from "next/link";
import { CalendarIcon, HangerIcon, HeartIcon, SearchIcon } from "./Icons";

/** Bottom tab bar, shown below 1024px only (see .tabs in home.css). */
export function MobileTabs({ active }: { active?: string }) {
  return (
    <nav className="tabs" aria-label="Main">
      <Link href="/outfits" aria-current={active === "outfits" ? "page" : undefined}>
        <HangerIcon />
        Outfits
      </Link>
      <Link href="/occasions" aria-current={active === "occasions" ? "page" : undefined}>
        <CalendarIcon />
        Occasions
      </Link>
      <Link href="/search" aria-current={active === "search" ? "page" : undefined}>
        <SearchIcon />
        Search
      </Link>
      <Link href="/saved" aria-current={active === "saved" ? "page" : undefined}>
        <HeartIcon />
        Saved
      </Link>
    </nav>
  );
}
