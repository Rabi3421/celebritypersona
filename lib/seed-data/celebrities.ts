/**
 * Seed source for the `celebrities` collection. Not read by the app.
 *
 * Only the editorial half: look counts, savings, price ranges, repeated labels
 * and the trending and new-archive flags are all counted from the outfits.
 */
import type { Celebrity } from "@/lib/types";

export const celebrities: Celebrity[] = [
  { id: 1, name: "Alia Bhatt", bio: [
    "Alia dresses like someone who decided what she likes and stopped negotiating. Ivory, oatmeal and dusty rose turn up again and again — across airports, promo tours and red carpets — and the silhouettes are almost always relaxed.",
    "When she does go big, it is usually one piece carrying the whole look against otherwise plain styling. Anita Dongre is her most repeated label, which makes her one of the easier people on this site to dupe well.",
  ]},
  { id: 2, name: "Deepika Padukone" },
  { id: 3, name: "Ananya Panday" },
  { id: 4, name: "Sara Ali Khan" },
  { id: 5, name: "Kiara Advani" },
  { id: 6, name: "Janhvi Kapoor" },
  { id: 7, name: "Katrina Kaif" },
  { id: 8, name: "Kareena Kapoor" },
  { id: 9, name: "Kriti Sanon" },
  { id: 10, name: "Rashmika Mandanna" },
  { id: 11, name: "Shraddha Kapoor" },
  { id: 12, name: "Tripti Dimri" },
  { id: 13, name: "Suhana Khan" },
  { id: 14, name: "Tamannaah Bhatia" },
  { id: 15, name: "Khushi Kapoor" },
  { id: 16, name: "Disha Patani" },
  { id: 17, name: "Vaani Kapoor" },
  { id: 18, name: "Nora Fatehi" },
];

