/** Seed source for the `celebrities` collection. Not read by the app. */
import type { Celebrity } from "@/lib/types";

export const celebrities: Celebrity[] = [
  { id: 1, name: "Alia Bhatt", looks: 47, averageSaving: 96, low: 42000, high: 1280000, brands: ["Anita Dongre", "Gucci", "Sabyasachi"], trending: true, bio: [
    "Alia dresses like someone who decided what she likes and stopped negotiating. Ivory, oatmeal and dusty rose turn up again and again — across airports, promo tours and red carpets — and the silhouettes are almost always relaxed.",
    "When she does go big, it is usually one piece carrying the whole look against otherwise plain styling. Anita Dongre is her most repeated label, which makes her one of the easier people on this site to dupe well.",
  ]},
  { id: 2, name: "Deepika Padukone", looks: 39, averageSaving: 97, low: 68000, high: 820000, brands: ["Sabyasachi", "Prada", "Raw Mango"], trending: true },
  { id: 3, name: "Ananya Panday", looks: 34, averageSaving: 95, low: 38000, high: 340000, brands: ["Fendi", "Self-Portrait", "Zara"], trending: true },
  { id: 4, name: "Sara Ali Khan", looks: 31, averageSaving: 94, low: 22000, high: 210000, brands: ["Ritu Kumar", "Fizzy Goblet"] },
  { id: 5, name: "Kiara Advani", looks: 28, averageSaving: 97, low: 74000, high: 820000, brands: ["Manish Malhotra", "Tanishq"] },
  { id: 6, name: "Janhvi Kapoor", looks: 22, averageSaving: 96, low: 24000, high: 735000, brands: ["Raw Mango", "Balenciaga"] },
  { id: 7, name: "Katrina Kaif", looks: 26, averageSaving: 95, low: 56000, high: 640000, brands: ["Sabyasachi", "Falguni Shane"] },
  { id: 8, name: "Kareena Kapoor", looks: 24, averageSaving: 94, low: 48000, high: 590000, brands: ["Anamika Khanna", "Gucci"] },
  { id: 9, name: "Kriti Sanon", looks: 21, averageSaving: 95, low: 34000, high: 380000, brands: ["Manish Malhotra", "Zara"] },
  { id: 10, name: "Rashmika Mandanna", looks: 19, averageSaving: 93, low: 18000, high: 240000, brands: ["Ritu Kumar", "Mango"], newArchive: true },
  { id: 11, name: "Shraddha Kapoor", looks: 18, averageSaving: 94, low: 26000, high: 290000, brands: ["Anita Dongre", "H&M"] },
  { id: 12, name: "Tripti Dimri", looks: 16, averageSaving: 92, low: 21000, high: 198000, brands: ["Raw Mango", "Zara"], newArchive: true, trending: true },
  { id: 13, name: "Suhana Khan", looks: 15, averageSaving: 96, low: 52000, high: 460000, brands: ["Prada", "Sabyasachi"], newArchive: true },
  { id: 14, name: "Tamannaah Bhatia", looks: 14, averageSaving: 93, low: 29000, high: 310000, brands: ["Amit Aggarwal", "Mango"] },
  { id: 15, name: "Khushi Kapoor", looks: 12, averageSaving: 95, low: 31000, high: 270000, brands: ["Miu Miu", "Zara"], newArchive: true },
  { id: 16, name: "Disha Patani", looks: 11, averageSaving: 92, low: 19000, high: 186000, brands: ["Versace", "H&M"] },
  { id: 17, name: "Vaani Kapoor", looks: 10, averageSaving: 93, low: 23000, high: 204000, brands: ["Falguni Shane", "Zara"] },
  { id: 18, name: "Nora Fatehi", looks: 9, averageSaving: 91, low: 27000, high: 228000, brands: ["Amit Aggarwal", "Mango"] },
];

