import Link from "next/link";
import type { HomeContent } from "@/lib/types";

/**
 * The campaign band's markup, exactly as the homepage draws it. Split out of
 * Campaign so the admin's Homepage Studio can preview the same markup with
 * unsaved copy; Campaign decides whether the band runs at all.
 */
export function CampaignBand({ campaign, looks }: { campaign: HomeContent["campaign"]; looks: number }) {
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
