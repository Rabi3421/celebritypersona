import Link from "next/link";
import { Brand } from "./Brand";
import { footerColumns } from "@/lib/navigation";

export function Footer() {
  return (
    <footer className="foot">
      <div className="shell">
        <div className="fgrid">
          <div className="fcol fbrand">
            <Brand />
            <p>
              What Indian celebrities wear, and where to get the look for money
              you actually have.
            </p>
          </div>
          {/* These were <h4> under the page's own <h2>s, which skipped two
              levels in the outline on every page of the site. Inside <footer>
              an <h2> is the right level, and each column is a nav in its own
              right. */}
          {footerColumns.map((column) => (
            <nav className="fcol" key={column.heading} aria-label={column.heading}>
              <h2>{column.heading}</h2>
              {column.links.map((link) =>
                link.href.startsWith("http") ? (
                  <a
                    href={link.href}
                    key={link.label}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                  </a>
                ) : link.href === "#" ? (
                  <a href="#" key={link.label}>
                    {link.label}
                  </a>
                ) : (
                  <Link href={link.href} key={link.label}>
                    {link.label}
                  </Link>
                ),
              )}
            </nav>
          ))}
        </div>
        <div className="fbot">
          <span>© 2026 CelebrityPersona</span>
          <span>Photos credited to their agencies</span>
          <span>We earn commission on some links</span>
        </div>
      </div>
    </footer>
  );
}
