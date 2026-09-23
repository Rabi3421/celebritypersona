/** Content types shared by the seed data, the database layer and the views. */

/**
 * The affiliate networks a link can be monetised through.
 *
 * "none" is a real answer, not a missing one: a retailer we have no
 * relationship with still gets linked, because the point of the page is to
 * show you where the piece is. Revenue is a side effect of being useful, and a
 * piece we cannot earn on is published exactly like one we can.
 */
export const LINK_NETWORKS = [
  "none",
  "amazon",
  "cuelinks",
  "earnkaro",
  "inrdeals",
  "other",
] as const;

export type LinkNetwork = (typeof LINK_NETWORKS)[number];

/**
 * What we currently believe about a link, and the only thing that decides
 * whether a Buy button is drawn.
 *
 *  - ok          checked, and the product is there
 *  - pending     we have named the retailer but have no URL yet
 *  - sold_out    the page is up, the item is not
 *  - dead        the URL 404s; nothing is shown and the panel flags it
 *  - unverified  we have not been able to confirm it either way, usually
 *                because the retailer blocks automated requests. The button
 *                is shown, because a link we cannot check is not a link we
 *                have reason to doubt, and the panel flags it for a person.
 *
 * Everything stored starts as `unverified` rather than `ok`: a URL that has
 * never been checked has not earned a claim that it works.
 */
export const LINK_STATUSES = ["ok", "pending", "sold_out", "dead", "unverified"] as const;

export type LinkStatus = (typeof LINK_STATUSES)[number];

/** Which half of a piece a link belongs to. */
export type PieceSide = "original" | "swap";

export type PieceLink = {
  /** Shown to the reader. Seeded from the hostname, edited by hand. */
  retailer: string;
  /** The product page itself, always stored, never replaced by the affiliate
   *  form of it. This is what a person checks and what the link checker reads. */
  url: string;
  /** The monetised form, when one exists. Pasted by hand today. */
  affiliateUrl?: string;
  network: LinkNetwork;
  status: LinkStatus;
  /** YYYY-MM-DD, written by `npm run check:links`. */
  checkedAt?: string;
};

export type OutfitItem = {
  /**
   * Stable per piece, so an outbound click can name what was clicked without
   * depending on the position of the piece in the array. Assigned on save and
   * backfilled by `npm run migrate:links`; absent only on a document neither
   * has touched yet, which draws no Buy button.
   */
  id?: string;
  name: string;
  /** Absent when the label she wore has not been identified — a piece we have
   *  only found the high-street version of is still worth publishing. */
  wornBrand?: string;
  /** Absent when the original price could not be confirmed. */
  worn?: number;
  /** Where to buy the original, when it is still on sale somewhere. */
  wornUrl?: string;
  /** The merchant has it listed but has run out. A link is not the same as
   *  stock, and saying so lets the page and its structured data stop claiming
   *  something a reader will discover is false one click later. */
  soldOut?: boolean;
  /** Absent until a swap has been found. A brand without a price is a swap we
   *  have named but not priced: it shows, it just does not count towards the
   *  savings, which only `hasSwap` pieces do. */
  swapBrand?: string;
  swap?: number;
  /** Where to buy the swap. */
  swapUrl?: string;
  /**
   * The link records that supersede `wornUrl`, `swapUrl` and `soldOut`.
   *
   * The old fields are still read through `pieceLink()`, so nothing has to be
   * migrated before the page works, and a document written before the
   * migration behaves exactly as it did.
   */
  wornLink?: PieceLink;
  swapLink?: PieceLink;
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

/**
 * A piece's link for one side, in whichever shape the document was written.
 *
 * `wornLink`/`swapLink` win. Falling back to the old `wornUrl`/`swapUrl` means
 * an unmigrated document keeps working and keeps its Buy button, rather than
 * every look going quiet the moment this ships. The derived record is marked
 * `unverified`, never `ok` — an old URL has not been checked, and the whole
 * point of the status is that it says what we actually know.
 */
export function pieceLink(item: OutfitItem, side: PieceSide): PieceLink | undefined {
  const stored = side === "original" ? item.wornLink : item.swapLink;
  if (stored) return stored;

  const url = side === "original" ? item.wornUrl : item.swapUrl;
  const brand = side === "original" ? item.wornBrand : item.swapBrand;
  if (!url) return undefined;

  return {
    retailer: retailerFromUrl(url) ?? brand ?? "Retailer",
    url,
    network: "none",
    status: side === "original" && item.soldOut ? "sold_out" : "unverified",
  };
}

/** The hostname, tidied, as a first guess at a retailer's name. */
export function retailerFromUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/** Where a click should actually go. The affiliate form when we have one. */
export const linkTarget = (link: PieceLink) => link.affiliateUrl?.trim() || link.url;

/**
 * Whether a click on this link is a commercial one.
 *
 * The presence of an affiliate URL decides it, and the network deliberately
 * does not. An editor who pastes a monetised link and forgets to set the
 * network would otherwise publish an affiliate link the page does not mark
 * and the disclosure does not cover — a disclosure failure caused by a
 * dropdown. This errs toward disclosing; the panel flags the mismatch so the
 * network can be set for reporting.
 *
 * Undefined is not monetised, so callers can pass a side with no link at all.
 */
export const isMonetised = (link: PieceLink | undefined) =>
  Boolean(link?.affiliateUrl?.trim());

/**
 * Whether the reader gets a Buy button.
 *
 * `unverified` shows one: a retailer that blocks our checker is not a retailer
 * whose link is broken, and hiding those would take down most of the archive
 * on the strength of a 403. `pending`, `sold_out` and `dead` do not.
 */
export const isBuyable = (link: PieceLink | undefined): link is PieceLink =>
  Boolean(link) && (link!.status === "ok" || link!.status === "unverified");

/** A piece we have actually found an alternative for. */
export type SwappedItem = OutfitItem & { swapBrand: string; swap: number };

export const hasSwap = (item: OutfitItem): item is SwappedItem =>
  typeof item.swap === "number" && Boolean(item.swapBrand);

export const hasWornPrice = (item: OutfitItem) => typeof item.worn === "number";

/** A piece whose original label we have actually identified. */
export type LabelledItem = OutfitItem & { wornBrand: string };

export const hasWornBrand = (item: OutfitItem): item is LabelledItem =>
  Boolean(item.wornBrand);

/** What the original half of a piece is called on the page. The label when we
 *  have it, and an honest blank when we do not — never an empty line. */
/**
 * What the original half of a piece is called on the page.
 *
 * "Unidentified" rather than "Label not confirmed", because that is the word
 * the site uses everywhere else it describes this state — the about page, the
 * method page and the homepage all promise that an unconfirmed label is
 * "marked unidentified". Two vocabularies for one state made the promise
 * impossible to check against the page.
 */
export const wornLabel = (item: OutfitItem) => item.wornBrand ?? "Unidentified";

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
  /** The day the look was added to the archive, set once when it is created
   *  and never touched by an edit. The "New" badge is counted from this, so
   *  nobody has to remember to tick or untick anything. Absent on looks saved
   *  before the field existed, which fall back to the look's own date. */
  publishedAt?: string;
  /**
   * Whether an editor considers this look finished.
   *
   * No document carries one today, and absent means published — every record
   * that exists was written straight to the live archive. The field is honoured
   * anyway so that the day a draft state is added, `isPublished` already refuses
   * to promote a draft just because somebody typed a price into it.
   */
  status?: OutfitStatus;
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

export type OutfitStatus = "draft" | "published";

/**
 * Whether a look may be shown to a reader.
 *
 * Two conditions, both required. The editor has not marked it a draft, and it
 * carries something worth publishing: a swap, or an original price somebody
 * confirmed. A look with neither is a name, a date and a photograph — there is
 * nothing decoded about it, so it has no page, no listing, no sitemap entry and
 * no place in any count the site quotes about itself.
 *
 * The status half matters even though nothing sets it yet: the price half must
 * never be able to publish a look on its own. An editor half way through
 * entering a piece has typed a price, and that cannot be what puts it live.
 *
 * This is deliberately stricter than `hasSubstance`, which asks a different
 * question — whether a published look is worth indexing — and which a note
 * alone can satisfy.
 */
export const isPublished = (outfit: Outfit) =>
  outfit.status !== "draft" &&
  (outfit.items.some(hasSwap) || outfit.items.some(hasWornPrice));

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

/**
 * One outbound click on a retailer link.
 *
 * Deliberately not a record of a person. There is no IP address, no
 * user-agent, no cookie, no session and no identifier of any kind here — not
 * hashed, not truncated, not "anonymised". What is stored is what was clicked
 * and when, which is enough to know which looks earn and which retailers
 * readers actually go to, and not enough to describe anybody.
 *
 * The privacy policy says exactly this, so anything added to this type has to
 * be added there first.
 */
export type LinkClick = {
  id: string;
  /** ISO timestamp. */
  at: string;
  outfitId: number;
  outfitSlug: string;
  pieceId: string;
  /** The piece's name, copied so a renamed or deleted piece keeps its history. */
  piece: string;
  side: PieceSide;
  retailer: string;
  network: LinkNetwork;
  /** The page the click came from, always a path on this site. */
  sourcePage: string;
  /** Whether the click went to a monetised URL, so revenue can be separated
   *  from traffic we send for nothing. */
  affiliate: boolean;
};

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
  /** The campaign band. Its look count is filled in from the archive. */
  campaign: { eyebrow: string; title: string; body: string; cta: string; href: string };
};

/**
 * A URL this site used to answer on.
 *
 * Kept in its own collection rather than on the record, because the thing most
 * likely to be renamed — a celebrity or occasion the outfits mention that no
 * record covers — has no record to keep it on. Consulted only when a slug
 * matches nothing live, so a name reused later still wins over its own history.
 */
export type SlugRedirect = {
  kind: "outfit" | "celebrity" | "occasion";
  from: string;
  to: string;
  at: string;
};
