import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  eyebrow: string;
  title: string;
  blurb?: ReactNode;
  moreLabel?: string;
  moreHref?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  blurb,
  moreLabel,
  moreHref = "#",
}: Props) {
  return (
    <div className="sec-h rv">
      <div>
        <p className="eb">{eyebrow}</p>
        <h2>{title}</h2>
        {blurb ? <p>{blurb}</p> : null}
      </div>
      {/* These are the homepage's hub links — "All outfits", "A–Z index",
          "All occasions", "Full leaderboard" — and the strongest internal
          links on the site. Written as a bare <a>, every one of them tore the
          app down and booted it again on click, with no prefetch. `Link`
          renders the same <a class="more">, so nothing about it looks or
          reads differently; external hrefs (the Instagram follow) stay a
          plain anchor, since Link is for routes this app owns. */}
      {moreLabel ? (
        moreHref.startsWith("/") ? (
          <Link href={moreHref} className="more">
            {moreLabel}
          </Link>
        ) : (
          <a href={moreHref} className="more">
            {moreLabel}
          </a>
        )
      ) : null}
    </div>
  );
}
