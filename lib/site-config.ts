/**
 * Single source of truth for the identity and contact details the legal and
 * editorial pages have to publish.
 *
 * Anything wrapped in PENDING is a real-world detail nobody can invent for you.
 * Indian law requires several of them by name, so fill them in before launch:
 *  - IT Rules 2021 require a named Grievance Officer and an address in India.
 *  - The DPDP Act 2023 requires a contactable person for data questions.
 * Unfilled values render as a visible amber chip so they cannot ship unnoticed.
 */

export const PENDING = "__PENDING__" as const;

export const pending = (value: string) => value.startsWith(PENDING);

/** Marks a value as still to be supplied, with a hint for whoever fills it. */
const todo = (hint: string) => `${PENDING}${hint}`;

/**
 * The one hostname the site answers on. celebritypersona.com 308-redirects to
 * www, so every canonical, sitemap entry and Open Graph URL has to be written
 * with the www in it: a canonical pointing at a URL that redirects asks Google
 * to index an address that does not serve the page.
 */
const DOMAIN = "celebritypersona.com";
const CANONICAL_HOST = `www.${DOMAIN}`;
const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;

/**
 * The origin every canonical, sitemap entry, Open Graph URL and mailed link is
 * written against.
 *
 * NEXT_PUBLIC_SITE_URL exists so a local or preview deployment can talk about
 * itself, but it is also the one setting that can silently invalidate every
 * canonical on the site — set to the bare domain, which 308-redirects to www,
 * it pointed all 41 sitemap entries and every canonical at an address that
 * never serves a page. Live, that is close to invisible: the pages look right
 * in a browser, and only a crawler notices.
 *
 * So a value naming this site's own domain is normalised to the canonical
 * host, in either direction, while a genuinely different host — localhost, a
 * preview URL — is left exactly as given. Trailing slashes go too, or
 * `${site.url}/outfits` comes out with two.
 */
function resolveOrigin(configured: string | undefined): string {
  const cleaned = configured?.trim().replace(/\/+$/, "");
  if (!cleaned) return CANONICAL_ORIGIN;

  try {
    const { protocol, host, hostname } = new URL(cleaned);
    const named = hostname.toLowerCase();
    if (named === DOMAIN || named === CANONICAL_HOST) return CANONICAL_ORIGIN;
    return `${protocol}//${host}`;
  } catch {
    // Not a URL at all. The canonical host is the safer answer than a value
    // that would end up spliced into every link on the site.
    return CANONICAL_ORIGIN;
  }
}

const origin = resolveOrigin(process.env.NEXT_PUBLIC_SITE_URL);

export const site = {
  name: "CelebrityPersona",
  domain: DOMAIN,
  /** Host shown to readers, and the one every canonical is written against. */
  host: CANONICAL_HOST,
  url: origin,
  tagline: "What Indian celebrities wear, and where to get the look.",
  launched: "2026",
};

export const legalEntity = {
  name: todo("registered company or proprietor name"),
  address: todo("registered address in India"),
  cin: todo("CIN or GST number, if registered"),
};

export const contacts = {
  general: `hello@${site.domain}`,
  editorial: `editor@${site.domain}`,
  corrections: `corrections@${site.domain}`,
  privacy: `privacy@${site.domain}`,
  copyright: `copyright@${site.domain}`,
  partnerships: `partners@${site.domain}`,
};

/** Required by IT Rules 2021 to be published with a name and contact. */
export const grievanceOfficer = {
  name: todo("grievance officer's full name"),
  designation: "Grievance Officer",
  email: `grievance@${site.domain}`,
  acknowledgeWithin: "24 hours",
  resolveWithin: "15 days",
};

/** DPDP Act 2023 grievance route, which runs to a 90-day outer limit. */
export const dataProtection = {
  contact: `privacy@${site.domain}`,
  resolveWithin: "90 days",
  board: "Data Protection Board of India",
};

/**
 * What the footer is allowed to say about photographs.
 *
 * It said "Photos credited to their agencies", which was false twice over:
 * there are no agency licences, and 45 of the archive's 49 photographs carry
 * no credit at all. A standing claim in the footer of every page is the worst
 * place to be wrong, because it is the one line a reader takes as policy.
 *
 * `credited` is published only when every photograph on every published look
 * names a source — the same test `npm run audit:credits` applies. Until then
 * `neutral` runs, which states who the photographs belong to and claims
 * nothing about what we have done about it.
 */
export const photoPolicy = {
  credited: "Photo sources credited on each image",
  neutral: "Photographs belong to their original owners",
};

/**
 * The person whose name is on the work.
 *
 * Google asks who wrote a page and whether they are worth believing, and an
 * author box is the site's answer. So it is not a place to be generous: the
 * bio is PENDING until a real one is supplied, and the page renders the byline
 * and the link without it rather than inventing a background. Same rule as the
 * legal identity — a claim about a person is not ours to write.
 */
export const author = {
  name: "Rabi",
  /** What the byline says under a decoded look. */
  role: "Editor",
  path: "/authors/rabi",
  bio: todo("a short, true biography — who Rabi is and why they can decode a look"),
  /** Real profiles only. Becomes `sameAs` on the Person. */
  sameAs: [] as string[],
};

export const social = {
  instagram: "https://www.instagram.com/celebritypersona",
  youtube: "https://www.youtube.com/@celebritypersona",
  pinterest: "https://www.pinterest.com/celebritypersona",
};

export const policyUpdated = "28 August 2026";
