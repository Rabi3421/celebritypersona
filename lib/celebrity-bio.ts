import type { CelebrityView } from "@/lib/archive";

/**
 * Falls back to a generated bio for anyone without a written one. The labels
 * and the look count come from the archive, so the fallback describes the
 * looks that are actually published rather than a number typed into a form.
 */
export function celebrityBio(celebrity: CelebrityView) {
  if (celebrity.bio?.length) return celebrity.bio;

  const { looks, brands } = celebrity.stats;
  const [first, second] = brands.map((brand) => brand.name);
  const labels = first
    ? `${first} and ${second ?? "high-street staples"} are among the labels that recur most often. `
    : "";
  const tally = looks
    ? `Across ${looks} decoded ${looks === 1 ? "appearance" : "appearances"}, those repeat choices make the proportions, palette, and affordable alternatives easier to identify with confidence.`
    : "Once her first look is decoded, the repeat choices behind the proportions, palette and affordable alternatives will be counted here.";

  return [
    `${celebrity.name}'s archive moves comfortably between polished occasion dressing and practical off-duty looks. The common thread is a clear silhouette, controlled colour, and one focal piece rather than styling that competes for attention.`,
    `${labels}${tally}`,
  ];
}
