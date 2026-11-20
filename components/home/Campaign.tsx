import { MIN_WEDDING_LOOKS } from "@/lib/thresholds";
import type { HomeContent } from "@/lib/types";
import { CampaignBand } from "./CampaignBand";

/**
 * Editorial copy from the panel, with the one number in it filled in from the
 * archive. The band used to promise 184 wedding looks whatever was published.
 *
 * Filling the number in was not enough on its own. "Six weeks to the shaadi.
 * Zero panic." followed by "1 look decoded across sangeet, mehendi and
 * reception" is a promise the archive cannot keep, and the number being
 * truthful does not rescue the sentence around it. The band now waits until
 * there are enough wedding looks for the copy to be worth running.
 */
export function Campaign({
  campaign,
  looks,
}: {
  campaign: HomeContent["campaign"];
  looks: number;
}) {
  if (looks < MIN_WEDDING_LOOKS) return null;
  return <CampaignBand campaign={campaign} looks={looks} />;
}
