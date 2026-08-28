/**
 * Homepage content.
 *
 * Everything the homepage renders lives here so copy and numbers can be edited
 * in one place, and later swapped for a CMS or database query without touching
 * the components.
 */

export type TickerEntry = {
  celebrity: string;
  occasion: string;
  worn: number;
  swap: number;
};

export type LookItem = {
  name: string;
  /** Short label used on the floating pills over the hero photo. */
  short: string;
  wornBrand: string;
  swapBrand: string;
  worn: number;
  swap: number;
};

export type OutfitCard = {
  celebrity: string;
  occasion: string;
  posted: string;
  tone: "" | "v2" | "v3" | "v4" | "v5";
  worn: number;
  swap: number;
  peek: { label: string; price: number }[];
};

export const heroLook = {
  date: "24 August 2026",
  occasion: "Airport",
  celebrity: "Alia Bhatt",
  headline: "Alia Bhatt at Mumbai Airport",
  summary:
    "Ivory kurta, structured tote, flat sandals, oversized sunglasses. Every piece identified, every price checked.",
  photoCredit: "Photo · Varinder Chawla",
  items: [
    {
      name: "Ivory cotton kurta",
      short: "Kurta",
      wornBrand: "Anita Dongre",
      swapBrand: "Libas",
      worn: 42000,
      swap: 1799,
    },
    {
      name: "Structured tote",
      short: "Tote",
      wornBrand: "Bottega Veneta",
      swapBrand: "Lino Perros",
      worn: 285000,
      swap: 1499,
    },
    {
      name: "Flat leather sandals",
      short: "Sandals",
      wornBrand: "Hermès",
      swapBrand: "Mochi",
      worn: 78000,
      swap: 892,
    },
    {
      name: "Oversized sunglasses",
      short: "Sunglasses",
      wornBrand: "Gucci",
      swapBrand: "Lenskart",
      worn: 38500,
      swap: 1299,
    },
  ] satisfies LookItem[],
};

export const heroTotals = {
  worn: heroLook.items.reduce((sum, item) => sum + item.worn, 0),
  swap: heroLook.items.reduce((sum, item) => sum + item.swap, 0),
};

export const navLinks = [
  { label: "Outfits", href: "/outfits" },
  { label: "Celebrities", href: "/celebrities" },
  { label: "Occasions", href: "/occasions" },
  { label: "Budget", href: "/budget" },
  { label: "Trending", href: "#" },
];

export const tickerEntries: TickerEntry[] = [
  {
    celebrity: "Deepika",
    occasion: "Mumbai airport",
    worn: 560000,
    swap: 4780,
  },
  { celebrity: "Ananya", occasion: "Delhi promo", worn: 185000, swap: 2990 },
  { celebrity: "Sara", occasion: "Jaipur sangeet", worn: 76000, swap: 1850 },
  { celebrity: "Kiara", occasion: "Red carpet", worn: 340000, swap: 5210 },
  { celebrity: "Janhvi", occasion: "Bandra casual", worn: 112000, swap: 2140 },
];

export const stats = [
  { value: 486, suffix: "", label: "Looks decoded" },
  { value: 2140, suffix: "", label: "Pieces identified" },
  { value: 94, suffix: "%", label: "Average saving" },
  { value: 7, suffix: " days", label: "Prices re-checked every" },
];

export const thisWeek: OutfitCard[] = [
  {
    celebrity: "Deepika Padukone",
    occasion: "Mumbai airport",
    posted: "2 days ago",
    tone: "",
    worn: 560000,
    swap: 4780,
    peek: [
      { label: "Kurta", price: 1799 },
      { label: "Tote", price: 1499 },
      { label: "Sandals", price: 892 },
    ],
  },
  {
    celebrity: "Ananya Panday",
    occasion: "Promo tour, Delhi",
    posted: "3 days ago",
    tone: "v2",
    worn: 185000,
    swap: 2990,
    peek: [
      { label: "Co-ord", price: 2190 },
      { label: "Heels", price: 1499 },
      { label: "Bag", price: 899 },
    ],
  },
  {
    celebrity: "Sara Ali Khan",
    occasion: "Sangeet, Jaipur",
    posted: "4 days ago",
    tone: "v3",
    worn: 76000,
    swap: 1850,
    peek: [
      { label: "Lehenga", price: 4200 },
      { label: "Jhumkas", price: 649 },
      { label: "Juttis", price: 1199 },
    ],
  },
  {
    celebrity: "Kiara Advani",
    occasion: "Red carpet",
    posted: "5 days ago",
    tone: "v4",
    worn: 340000,
    swap: 5210,
    peek: [
      { label: "Gown", price: 3890 },
      { label: "Clutch", price: 1120 },
      { label: "Heels", price: 1499 },
    ],
  },
  {
    celebrity: "Janhvi Kapoor",
    occasion: "Casual, Bandra",
    posted: "6 days ago",
    tone: "v5",
    worn: 112000,
    swap: 2140,
    peek: [
      { label: "Tee", price: 599 },
      { label: "Denim", price: 1299 },
      { label: "Sneakers", price: 2240 },
    ],
  },
];

export const swapSteps = [
  {
    n: "01",
    title: "We identify every piece",
    body: "By hand, not scraped. Brand, item, exact product page.",
  },
  {
    n: "02",
    title: "We find the closest swap",
    body: "Across Myntra, Ajio, Nykaa and more — matched on cut and fabric, not just colour.",
  },
  {
    n: "03",
    title: "We test every link weekly",
    body: "Sold out gets labelled. Dead links get removed, not hidden.",
  },
];

export const budgetTiers = [
  { cap: 2000, looks: 64 },
  { cap: 5000, looks: 148 },
  { cap: 10000, looks: 231 },
];

export const dupeOfTheWeek = {
  worn: { name: "Sabyasachi silk lehenga", price: 485000 },
  swap: { name: "Libas embroidered lehenga", price: 4299 },
};

export const occasions = [
  { name: "Airport", looks: 142 },
  { name: "Sangeet", looks: 58 },
  { name: "Red carpet", looks: 91 },
  { name: "Mehendi", looks: 44 },
  { name: "Reception", looks: 37 },
  { name: "Diwali", looks: 29 },
  { name: "Promo tour", looks: 76 },
  { name: "Casual", looks: 103 },
];

export const trendingSearches = [
  { term: "alia bhatt airport", count: "1.2k" },
  { term: "sangeet lehenga under 5000", count: "940" },
  { term: "deepika saree", count: "870" },
  { term: "ananya panday co-ord", count: "610" },
  { term: "diwali kurta set", count: "580" },
  { term: "bollywood dupe myntra", count: "520" },
  { term: "kiara red carpet", count: "440" },
  { term: "mehendi outfit ideas", count: "390" },
  { term: "sara ali khan jutti", count: "310" },
  { term: "janhvi casual look", count: "270" },
];

export const celebrities = [
  { name: "Alia Bhatt", looks: 47 },
  { name: "Deepika Padukone", looks: 39 },
  { name: "Ananya Panday", looks: 34 },
  { name: "Sara Ali Khan", looks: 31 },
  { name: "Kiara Advani", looks: 28 },
  { name: "Janhvi Kapoor", looks: 22 },
];

export const brands = [
  "Sabyasachi",
  "Anita Dongre",
  "Manish Malhotra",
  "Myntra",
  "Ajio",
  "Nykaa Fashion",
  "Libas",
  "Mochi",
  "Lenskart",
  "Gucci",
  "Bottega Veneta",
  "Hermès",
  "Zara",
  "H&M",
  "Westside",
];

export const trustPoints = [
  {
    n: "01",
    title: "A person, not a scraper",
    body: "Every piece is identified by hand. If we can't confirm a brand, we mark it unidentified rather than guess.",
  },
  {
    n: "02",
    title: "Prices re-checked weekly",
    body: "Each outfit page shows when its prices were last verified. If it's gone stale, you'll see that too.",
  },
  {
    n: "03",
    title: "Dead links removed",
    body: "We test every link. Sold out is labelled sold out — we don't send you to an empty page.",
  },
  {
    n: "04",
    title: "Swaps are labelled swaps",
    body: "A lookalike is never presented as the real piece. You always know which one you're buying.",
  },
];

export const reels = [
  { views: "142k", caption: "Alia ka ₹4.4 lakh look → ₹5,489 mein" },
  { views: "98k", caption: "Sangeet lehenga under ₹5,000" },
  { views: "211k", caption: "Deepika airport look decode" },
  { views: "76k", caption: "Yeh bag actually kitne ka hai?" },
  { views: "134k", caption: "Diwali kurta sets — 5 dupes" },
  { views: "89k", caption: "Red carpet vs Myntra" },
];

export const footerColumns = [
  {
    heading: "Browse",
    links: [
      "All outfits",
      "Celebrities",
      "Occasions",
      "By budget",
      "Trending",
      "Wedding edit",
    ],
  },
  {
    heading: "About",
    links: [
      "Who we are",
      "How we work",
      "Corrections",
      "Contact",
      "Report a price",
    ],
  },
  {
    heading: "Legal",
    links: [
      "Privacy",
      "Terms",
      "Affiliate disclosure",
      "Cookies",
      "DMCA",
      "Photo credits",
    ],
  },
  {
    heading: "Follow",
    links: ["Instagram", "YouTube", "Pinterest", "WhatsApp updates"],
  },
];
