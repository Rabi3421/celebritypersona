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
      {moreLabel ? (
        <a href={moreHref} className="more">
          {moreLabel}
        </a>
      ) : null}
    </div>
  );
}
