import type { Celebrity } from "@/lib/types";

/** Falls back to a generated bio for anyone without a written one. */
export function celebrityBio(celebrity: Celebrity) {
  if (celebrity.bio) return celebrity.bio;
  const [first, second = "high-street staples"] = celebrity.brands;
  return [
    `${celebrity.name}'s archive moves comfortably between polished occasion dressing and practical off-duty looks. The common thread is a clear silhouette, controlled colour, and one focal piece rather than styling that competes for attention.`,
    `${first} and ${second} are among the labels that recur most often. Across ${celebrity.looks} decoded appearances, those repeat choices make the proportions, palette, and affordable alternatives easier to identify with confidence.`,
  ];
}
