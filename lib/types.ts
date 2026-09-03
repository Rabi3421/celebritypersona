/** Content types shared by the seed data, the database layer and the views. */

export type OutfitItem = {
  name: string;
  wornBrand: string;
  /** Absent when the original price could not be confirmed. */
  worn?: number;
  /** Where to buy the original, when it is still on sale somewhere. */
  wornUrl?: string;
  /** The merchant has it listed but has run out. A link is not the same as
   *  stock, and saying so lets the page and its structured data stop claiming
   *  something a reader will discover is false one click later. */
  soldOut?: boolean;
  /** Both absent until a swap has been found. Never one without the other. */
  swapBrand?: string;
  swap?: number;
  /** Where to buy the swap. */
  swapUrl?: string;
  /** One line the merchant cannot supply: fabric, fit, why it works. This is
   *  the difference between a listing and a decoded piece. */
  note?: string;
  /** Where this piece sits on the outfit photo, as percentages of width and
   *  height, so the dot stays put at any image size. */
  hotspot?: { x: number; y: number };
};

export type OutfitImage = {
  url: string;
  /** Storage path, kept so the file can be deleted when it is replaced. */
  path: string;
  credit?: string;
  /** What the photo shows, for a reader who cannot see it and for image
   *  search. Absent on photos saved before the field existed, which fall back
   *  to a line built from the look. */
  alt?: string;
};

/**
 * Photos of a look, newest shape first. `image` is the single-photo shape
 * older documents were written with; reading through here means nothing has
 * to be migrated before the gallery works.
 */
export const outfitPhotos = (outfit: {
  image?: OutfitImage;
  images?: OutfitImage[];
}): OutfitImage[] =>
  outfit.images?.length ? outfit.images : outfit.image ? [outfit.image] : [];

/** The photo every card and the detail hero lead with, and the one the
 *  hotspot dots are placed on. */
export const outfitPhoto = (outfit: { image?: OutfitImage; images?: OutfitImage[] }) =>
  outfitPhotos(outfit)[0];

/** A piece we have actually found an alternative for. */
export type SwappedItem = OutfitItem & { swapBrand: string; swap: number };

export const hasSwap = (item: OutfitItem): item is SwappedItem =>
  typeof item.swap === "number" && Boolean(item.swapBrand);

export const hasWornPrice = (item: OutfitItem) => typeof item.worn === "number";

/**
 * True only when every piece has an alternative. A look still missing a swap
 * cannot honestly be offered as something you could buy for its total.
 */
export const isFullySwapped = (outfit: { items: OutfitItem[] }) =>
  outfit.items.length > 0 && outfit.items.every(hasSwap);

/** Everything the views need to describe a look's prices without overclaiming. */
export type OutfitPricing = {
  pieces: number;
  /** Pieces with an alternative found. */
  swapped: number;
  /** Pieces whose original price we could confirm. */
  priced: number;
  wornTotal: number;
  swapTotal: number;
  /** Only pieces priced on both sides can produce an honest saving. */
  savingTotal: number;
  savingPct: number | null;
  allSwapped: boolean;
  anySwapped: boolean;
  allPriced: boolean;
  anyPriced: boolean;
};

export function pricing(outfit: { items: OutfitItem[] }): OutfitPricing {
  const items = outfit.items;
  const swappedItems = items.filter(hasSwap);
  const pricedItems = items.filter(hasWornPrice);
  const comparable = items.filter((item) => hasSwap(item) && hasWornPrice(item));

  const comparableWorn = comparable.reduce((sum, item) => sum + (item.worn ?? 0), 0);
  const comparableSwap = comparable.reduce((sum, item) => sum + (item.swap ?? 0), 0);

  return {
    pieces: items.length,
    swapped: swappedItems.length,
    priced: pricedItems.length,
    wornTotal: pricedItems.reduce((sum, item) => sum + (item.worn ?? 0), 0),
    swapTotal: swappedItems.reduce((sum, item) => sum + item.swap, 0),
    savingTotal: comparableWorn - comparableSwap,
    savingPct:
      comparable.length > 0 && comparableWorn > 0
        ? Math.floor(((comparableWorn - comparableSwap) / comparableWorn) * 100)
        : null,
    allSwapped: items.length > 0 && swappedItems.length === items.length,
    anySwapped: swappedItems.length > 0,
    allPriced: items.length > 0 && pricedItems.length === items.length,
    anyPriced: pricedItems.length > 0,
  };
}

/**
 * Prices a card can show without lying, and the sort keys that go with them.
 *
 * Every one of these used to be read off the top-level `worn`/`swap` fields
 * below, which are written once and never recomputed when an editor edits a
 * piece. A look whose pieces carry no alternative therefore still had
 * `swap: 0`, so cards printed "₹0" beside the real price and badged the look
 * "−100%". `null` here means "not established", and the views print
 * "No swap yet" rather than a number.
 */
export const wornPrice = (outfit: { items: OutfitItem[] }) => {
  const money = pricing(outfit);
  return money.anyPriced ? money.wornTotal : null;
};

export const swapPrice = (outfit: { items: OutfitItem[] }) => {
  const money = pricing(outfit);
  return money.anySwapped ? money.swapTotal : null;
};

/** Null unless at least one piece is priced on both sides. */
export const savingPercent = (outfit: { items: OutfitItem[] }) => pricing(outfit).savingPct;

/** Sort keys. Looks with nothing to compare sink rather than leading a
 *  "cheapest first" list at ₹0. */
export const swapSortKey = (outfit: { items: OutfitItem[] }) =>
  swapPrice(outfit) ?? Number.POSITIVE_INFINITY;
export const wornSortKey = (outfit: { items: OutfitItem[] }) => wornPrice(outfit) ?? 0;
export const savingSortKey = (outfit: { items: OutfitItem[] }) => pricing(outfit).savingTotal;

export type Outfit = {
  id: number;
  celebrity: string;
  event: string;
  occasion: string;
  date: string;
  /** @deprecated Stored totals, never recomputed on edit. Use `pricing()`,
   *  `wornPrice()` and `swapPrice()` — nothing rendered should read these. */
  worn: number;
  /** @deprecated See `worn`. */
  swap: number;
  isNew?: boolean;
  /** Editor-chosen URL segment. Also names the storage folder its photos are
   *  uploaded into. Absent on older looks, which fall back to a derived slug. */
  slug?: string;
  /** What the search result says. Both optional: left empty, the page builds
   *  them from the look itself, so a look is never untitled in a SERP. */
  seoTitle?: string;
  seoDescription?: string;
  /** Superseded by `images`. Still read, so older documents keep their photo. */
  image?: OutfitImage;
  images?: OutfitImage[];
  /** The editor's own writing about the look, one paragraph per entry. */
  notes?: string[];
  /** When the prices on this look were last put in front of a person, set on
   *  every save. The page used to claim "2 days ago" no matter what. */
  pricesCheckedAt?: string;
  items: OutfitItem[];
};

/**
 * Whether a look offers anything a shopper could not get from the brand's own
 * product page. Without either, the page is a product name and a buy link —
 * what Google's spam policy calls thin affiliation — so it stays out of the
 * index until there is a reason for it to be there.
 */
export const hasSubstance = (outfit: Outfit) =>
  Boolean(outfit.notes?.length) ||
  outfit.items.some(hasSwap) ||
  outfit.items.some((item) => item.note?.trim());

/**
 * What an editor writes about a person. Everything countable — how many looks,
 * what she wears, what her looks cost, whether the archive is fresh or
 * trending — is derived from the outfits themselves in `lib/archive.ts`, so a
 * record can never claim 47 looks while the archive holds three.
 */
export type Celebrity = {
  id: number;
  name: string;
  bio?: string[];
  /** Her own profiles — Instagram, Wikipedia. Emitted as `sameAs` so a look
   *  page names the person Google already knows rather than a string. */
  sameAs?: string[];
};

export type OccasionGroup = "Wedding" | "Festival" | "Everyday";

/**
 * The editorial half of an occasion. Its counts, price averages, cheapest
 * complete look and garment tally all come from the archive.
 */
export type Occasion = {
  id: number;
  name: string;
  group: OccasionGroup;
  peak: string;
  description: string;
  colours: { name: string; value: string }[];
  /** The next real-world date this occasion falls on, YYYY-MM-DD. Drives the
   *  "Coming up" rail, whose countdown is calculated rather than typed. */
  nextDate?: string;
};

export type SearchIntent =
  | "Celebrity"
  | "Occasion"
  | "Budget"
  | "Brand"
  | "How to";

export type TrendingSearch = {
  term: string;
  volume: number;
  changePct: number;
  intent: SearchIntent;
  href: string;
  /** The one-line answer. Competitors publish the price and stop here. */
  answer: string;
};

/** What a reader can tell us about a look. "Swap suggestion" is the one that
 *  adds something rather than correcting something. */
export const PRICE_REPORT_ISSUES = [
  "Price is wrong",
  "Link is dead",
  "Sold out",
  "Wrong brand or piece",
  "Swap suggestion",
] as const;

export type PriceReportIssue = (typeof PRICE_REPORT_ISSUES)[number];

export const PRICE_REPORT_STATUSES = [
  "New",
  "Checked",
  "Fixed",
  "No change needed",
] as const;

export type PriceReportStatus = (typeof PRICE_REPORT_STATUSES)[number];

export type PriceReport = {
  id: string;
  /** ISO timestamp. Older rows carry a plain YYYY-MM-DD, which still sorts. */
  receivedAt: string;
  /** The look it is about. Empty when the reader could not name one. */
  outfitSlug: string;
  issue: PriceReportIssue;
  detail: string;
  /** Which piece on the look, when the reader named one. */
  piece?: string;
  /** The retailer page backing the report, or the suggested swap. */
  sourceUrl?: string;
  reporterEmail?: string;
  status: PriceReportStatus;
  /** What the editor did about it. */
  note?: string;
};

export const REQUEST_STATUSES = ["New", "Queued", "Decoded", "Declined"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/**
 * Someone the readers want decoded. The public page promises the most-asked-for
 * names get done first, so repeats add a vote rather than a duplicate row.
 */
export type CelebrityRequest = {
  id: string;
  name: string;
  votes: number;
  firstAskedAt: string;
  lastAskedAt: string;
  status: RequestStatus;
};

/**
 * Where an address stands with us.
 *
 * `Pending` is an address that asked but has not clicked the link, and is the
 * only honest place to start: anyone can type someone else's address into a
 * form. `Bounced` and `Complained` are terminal — a mailbox that rejected us
 * or a reader who pressed "spam" must never be written to again, because
 * doing so is what destroys a sending reputation.
 */
export const SUBSCRIBER_STATUSES = [
  "Pending",
  "Active",
  "Unsubscribed",
  "Bounced",
  "Complained",
] as const;
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];

/** The statuses an address may be written to. Everything else is silence. */
export const MAILABLE: readonly SubscriberStatus[] = ["Active"];

/**
 * Whether this row can actually receive a mail — the one rule the panel's
 * audience count and the sender's recipient list both use, so the number shown
 * on the button is the number of people written to. Status alone is not
 * enough: rows carried over from the WhatsApp list are Active and have no
 * address at all.
 */
export const isMailable = (subscriber: Subscriber) =>
  MAILABLE.includes(subscriber.status) && Boolean(subscriber.email?.trim());

/** What we can show about how an address reached the list, on the day
 *  somebody asks. */
export type OptInRecord = {
  /** Where the form was, e.g. "homepage". */
  source: string;
  /** The exact promise made next to the button, kept verbatim. */
  wording: string;
  at: string;
  ip?: string;
};

/** An address that asked for the new looks. */
export type Subscriber = {
  id: string;
  /** Lowercased and trimmed. The natural key, so signing up twice returns to
   *  the same row rather than making a second one. */
  email: string;
  /** A WhatsApp number collected before this list moved to email. Kept because
   *  a real person gave it to us; never written to, because we have no way to
   *  write to it and never had their permission to mail them. */
  number?: string;
  status: SubscriberStatus;
  joinedAt: string;
  /** When the link in the confirmation mail was clicked. */
  confirmedAt?: string;
  optIn?: OptInRecord;
  /** Single use, and short-lived. */
  confirmToken?: string;
  confirmSentAt?: string;
  /** Never expires: it has to still work from a mail sent a year ago. */
  unsubscribeToken: string;
  unsubscribedAt?: string;
  /** Why we stopped — a bounce, a complaint, or their own choice. */
  stoppedReason?: string;
  lastSentAt?: string;
};

/**
 * One announcement, queued rather than sent.
 *
 * The look is copied into the job at the moment it is queued, so editing or
 * deleting the outfit afterwards cannot change a mail that is already going
 * out — and cannot leave half a send describing something else.
 */
export const MAIL_JOB_STATUSES = [
  "Queued",
  "Sending",
  "Sent",
  "Cancelled",
  "Failed",
] as const;
export type MailJobStatus = (typeof MAIL_JOB_STATUSES)[number];

export type MailJob = {
  id: string;
  /** One job per look, so pressing the button twice cannot send twice. */
  outfitId: number;
  status: MailJobStatus;
  subject: string;
  /** The look as it read when queued. */
  look: {
    celebrity: string;
    event: string;
    slug: string;
    url: string;
    image?: string;
    pieces: number;
    worn?: number;
  };
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  sent: number;
  failed: number;
  /** How many were Active when the job was made — what the panel promised. */
  audience: number;
  error?: string;
};

/** One attempt at one address. Its (jobId, email) pair is unique, which is
 *  what stops a retried batch mailing anybody twice. */
export type MailDelivery = {
  jobId: string;
  email: string;
  status: "Sent" | "Failed" | "Skipped";
  at: string;
  detail?: string;
};

export type TickerEntry = {
  celebrity: string;
  occasion: string;
  worn: number;
  swap: number;
};

/** Everything on the homepage that is editorial rather than counted. */
export type HomeContent = {
  swapSteps: { n: string; title: string; body: string }[];
  trustPoints: { n: string; title: string; body: string }[];
  reels: { views: string; caption: string }[];
  /** The campaign band. Its look count is filled in from the archive. */
  campaign: { eyebrow: string; title: string; body: string; cta: string; href: string };
};
