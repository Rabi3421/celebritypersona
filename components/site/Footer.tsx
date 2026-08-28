import { Brand } from "./Brand";
import { footerColumns } from "@/lib/home-content";

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
              {column.links.map((label) => (
                <a href="#" key={label}>
                  {label}
                </a>
              ))}
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
