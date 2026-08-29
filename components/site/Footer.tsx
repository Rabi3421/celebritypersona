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
          {footerColumns.map((column) => (
            <div className="fcol" key={column.heading}>
              <h4>{column.heading}</h4>
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
            </div>
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
