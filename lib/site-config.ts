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
const CANONICAL_ORIGIN = "https://www.celebritypersona.com";

/** Trailing slashes make `${site.url}/outfits` come out with two. */
const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? CANONICAL_ORIGIN).replace(/\/+$/, "");

export const site = {
  name: "CelebrityPersona",
  domain: "celebritypersona.com",
  /** Host shown to readers, and the one every canonical is written against. */
  host: "www.celebritypersona.com",
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

export const social = {
  instagram: "https://www.instagram.com/celebritypersona",
  youtube: "https://www.youtube.com/@celebritypersona",
  pinterest: "https://www.pinterest.com/celebritypersona",
};

export const policyUpdated = "28 August 2026";
