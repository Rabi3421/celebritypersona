import Link from "next/link";
import { Brand } from "./Brand";
import { SavedBadge } from "./SavedBadge";
import { SiteSearch } from "./SiteSearch";
import { navLinks } from "@/lib/navigation";

/** Sticky top bar. The `stuck` class is toggled on scroll by ScrollEffects. */
export function Nav({ active }: { active?: string }) {
  return (
    <nav className="nav" id="nav">
      <div className="nav-in shell">
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
        <div className="nav-end">
          <SiteSearch />
          <SavedBadge />
        </div>
      </div>
    </nav>
  );
}
