import { LINK_NETWORKS, type LinkNetwork } from "@/lib/types";

/**
 * How a raw product URL becomes a monetised one.
 *
 * Every Indian affiliate network does this differently. Amazon appends a tag.
 * Cuelinks and INRDeals wrap the URL in a redirector. EarnKaro issues a short
 * link per product from their dashboard and there is no formula for it at all.
 *
 * None of that is settled here, because none of the accounts are approved yet.
 * What is settled is the shape: a network either knows how to build the link
 * or it does not, and `convert` returning null is the honest answer for one
 * that does not. Every network returns null today, so every affiliate URL is
 * pasted by hand — which is also the only form that cannot silently produce a
 * broken or unattributed link while nobody is watching.
 *
 * To wire one up later: fill in its `convert`, and the admin form starts
 * offering to build the link instead of asking for it. Nothing else changes.
 */

export interface AffiliateNetwork {
  id: LinkNetwork;
  /** Shown in the admin form's network dropdown. */
  label: string;
  /**
   * The monetised form of `rawUrl`, or null when this network cannot be
   * derived and an affiliate URL has to be pasted.
   *
   * Must return null rather than guess. A link that looks monetised and is not
   * earns nothing and tells nobody.
   */
  convert(rawUrl: string): string | null;
  /** One line for the editor, on what to paste and where it comes from. */
  hint: string;
}

/** A network we have not automated. The default, and currently all of them. */
const manual = (id: LinkNetwork, label: string, hint: string): AffiliateNetwork => ({
  id,
  label,
  convert: () => null,
  hint,
});

export const AFFILIATE_NETWORKS: Record<LinkNetwork, AffiliateNetwork> = {
  none: manual(
    "none",
    "No network",
    "A retailer we earn nothing from. Link it anyway if it is the right piece.",
  ),
  amazon: manual(
    "amazon",
    "Amazon Associates",
    "Paste the SiteStripe link from Amazon, or the product URL with your ?tag= on it.",
  ),
  cuelinks: manual(
    "cuelinks",
    "Cuelinks",
    "Paste the link Cuelinks generates for this product page.",
  ),
  earnkaro: manual(
    "earnkaro",
    "EarnKaro",
    "Paste the EarnKaro short link. EarnKaro issues one per product; there is no formula.",
  ),
  inrdeals: manual(
    "inrdeals",
    "INRDeals",
    "Paste the INRDeals link for this product page.",
  ),
  other: manual(
    "other",
    "Other network",
    "Any network not listed. Paste the monetised URL as the network gave it to you.",
  ),
};

export const networkOptions = LINK_NETWORKS.map((id) => ({
  value: id,
  label: AFFILIATE_NETWORKS[id].label,
}));

/**
 * The monetised URL for a raw one, when the network can build it.
 *
 * Returns null for every network today. Kept so the admin form and the
 * migration can already ask the question, rather than growing a new branch the
 * day the first account is approved.
 */
export function deriveAffiliateUrl(network: LinkNetwork, rawUrl: string): string | null {
  return AFFILIATE_NETWORKS[network]?.convert(rawUrl) ?? null;
}
