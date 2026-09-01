import Link from "next/link";
import type { HomeContent } from "@/lib/types";

/**
 * Editorial copy from the panel, with the one number in it filled in from the
 * archive. The band used to promise 184 wedding looks whatever was published.
 */
export function Campaign({
  campaign,
  looks,
}: {
  campaign: HomeContent["campaign"];
  looks: number;
}) {
  if (looks === 0) return null;

  return (
    <section className="sec">
      <div className="camp rv">
        <div className="in">
          <p className="eb">{campaign.eyebrow}</p>
          <h2>{campaign.title}</h2>
          <p>
            {looks} {looks === 1 ? "look" : "looks"} {campaign.body}
          </p>
          <Link className="btn" href={campaign.href}>
            <span>{campaign.cta}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
