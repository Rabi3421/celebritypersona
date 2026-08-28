import Link from "next/link";
import { Brand } from "./Brand";
import { HeartIcon, SearchIcon } from "./Icons";
import { navLinks } from "@/lib/home-content";

/** Sticky top bar. The `stuck` class is toggled on scroll by ScrollEffects. */
export function Nav({
  savedCount = 3,
  active,
}: {
  savedCount?: number;
  active?: string;
}) {
  return (
    <nav className="nav" id="nav">
      <Brand />
      <div className="navlinks">
        {navLinks.map((link) => (
          <Link
            href={link.href}
            key={link.label}
            aria-current={active === link.label.toLowerCase() ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <div className="navsearch">
        <SearchIcon className="ic" />
        <input
          placeholder="Search a celebrity, occasion or brand"
          aria-label="Search"
        />
      </div>
      <button className="navsave" aria-label={`Saved looks (${savedCount})`}>
        <HeartIcon />
        <b aria-hidden="true">{savedCount}</b>
      </button>
    </nav>
  );
}
