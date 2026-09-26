/**
 * The controlled vocabularies a piece is filed under.
 *
 * "The pieces" and "Palette" used to be read out of piece names: the last word
 * became the garment and any colour word anywhere became a swatch, which is how
 * a dress "with Mesh Sleeves" was filed as Sleeves and a heel called "Black
 * Rose" put Rose in the palette. An editor now picks from these instead, and
 * the page prints what was picked.
 *
 * Adding a value is safe. Renaming or removing one strands every piece already
 * filed under it, so do that with a script, not an edit here.
 */

export const PIECE_CATEGORIES = [
  "dress",
  "saree",
  "lehenga",
  "kurta set",
  "anarkali",
  "co-ord",
  "jumpsuit",
  "gown",
  "top",
  "shirt",
  "blazer",
  "skirt",
  "trousers",
  "jeans",
  "heels",
  "sandals",
  "flats",
  "sneakers",
  "bag",
  "earrings",
  "necklace",
  "ring",
  "bangles",
  "sunglasses",
  "other",
] as const;

export type PieceCategory = (typeof PIECE_CATEGORIES)[number];

export const isPieceCategory = (value: string): value is PieceCategory =>
  (PIECE_CATEGORIES as readonly string[]).includes(value);

/** Colour names and the swatch each is drawn with. The name is what is stored. */
export const PIECE_COLOURS = {
  black: "#1C1C1C",
  white: "#FBFAF7",
  ivory: "#F2EDE3",
  cream: "#F3EAD9",
  beige: "#E4D8C3",
  nude: "#E3C9B4",
  brown: "#6B4B32",
  tan: "#B08655",
  grey: "#8A8A8A",
  silver: "#C9CBCC",
  gold: "#C7A24B",
  champagne: "#E4D3AC",
  red: "#C0392B",
  maroon: "#6E1B23",
  burgundy: "#5C1A2B",
  pink: "#E8A0B4",
  blush: "#EEC9C6",
  peach: "#F0B79A",
  coral: "#E8735C",
  orange: "#D97A34",
  rust: "#B5502A",
  mustard: "#C8992E",
  yellow: "#E8C24A",
  green: "#3F6B4A",
  olive: "#6B7256",
  sage: "#9CAF94",
  emerald: "#0E5E45",
  mint: "#BBD8C6",
  teal: "#256B6B",
  blue: "#2E4E7E",
  navy: "#1B2A4A",
  "powder blue": "#BCCEE0",
  purple: "#5B3A78",
  lilac: "#C3B2D8",
  lavender: "#CBC0DE",
  mauve: "#B08A9B",
  multicolour: "linear-gradient(90deg,#C0392B,#E8C24A,#3F6B4A,#2E4E7E)",
} as const;

export type PieceColour = keyof typeof PIECE_COLOURS;

export const PIECE_COLOUR_NAMES = Object.keys(PIECE_COLOURS) as PieceColour[];

export const isPieceColour = (value: string): value is PieceColour => value in PIECE_COLOURS;
