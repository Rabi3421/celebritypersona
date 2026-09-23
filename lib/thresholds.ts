/**
 * How much real data a claim needs behind it before the site is allowed to
 * make it.
 *
 * Every number on this site is already computed from the archive rather than
 * typed in, which stops the site quoting a figure nobody stands behind. It
 * does not stop the site quoting a figure that is *technically* true and
 * useless: "average saving 92%" is arithmetic on a single look, and a wedding
 * band promising "all decoded" is a promise made by one sangeet outfit.
 *
 * So the derived figures and the editorial claims that lean on them are gated
 * here. Below the threshold the element is hidden or the copy falls back to
 * something neutral — never to a placeholder, and never to a smaller claim
 * dressed up as the same one.
 *
 * These are the dials. Raise them to be stricter; lower them as the archive
 * fills up. Nothing else in the codebase should hard-code a count like this.
 */

/**
 * Complete looks — priced on both sides, so a saving can actually be computed
 * — needed before "Average saving %" is published on the homepage and the
 * outfits index.
 *
 * One look produces an average. It does not produce a representative one, and
 * a reader reads it as a claim about the archive.
 */
export const MIN_LOOKS_FOR_STATS = 10;

/**
 * Wedding looks needed before the homepage's wedding band and the occasions
 * hub's "wedding season" feature are allowed to run.
 *
 * Both are written as though the five wedding events are covered. Below this,
 * they are not, and the honest move is silence rather than a thinner promise.
 */
export const MIN_WEDDING_LOOKS = 6;

/**
 * Complete looks needed before the budget page's title and description are
 * allowed to name specific price ceilings.
 *
 * Tiers are computed from the spread of what the archive's complete looks
 * actually cost, so with two looks the "tiers" are just those two prices
 * rounded. The metadata falls back to neutral wording instead.
 */
export const MIN_LOOKS_FOR_BUDGET_TIERS = 6;

/**
 * Complete looks rebuilding under ₹5,000 needed before the trending FAQ is
 * allowed to answer "often, yes" to the under-₹5,000 question.
 */
export const MIN_LOOKS_FOR_UNDER_5K = 5;

/** The ceiling that FAQ asks about. */
export const UNDER_5K = 5000;

/**
 * Answerable rows needed before the trending leaderboard is published at all.
 *
 * A row is answerable when the archive holds looks the term actually finds.
 * Rows it does not are still real questions readers ask, and they stay in the
 * panel as the work queue — but "Not decoded yet" ten times over is a list of
 * things the site cannot do, printed under a heading claiming to answer them.
 * Below this, the board and the homepage band are absent instead.
 */
export const MIN_ANSWERABLE_TRENDING = 3;

/**
 * How long a recorded check stands before the page says it is overdue.
 *
 * It was 15 days, in lib/freshness.ts. Every look in the archive had been
 * checked 16 days earlier, so every outfit page carried "Verification
 * overdue" — a warning on all of them, which is a warning on none of them.
 *
 * Thirty days is a fortnight of slack on a monthly rhythm, and it is the
 * number to move when that rhythm changes. `CURRENT_PRICE_DAYS` still marks
 * the shorter window inside which a check counts as recent.
 */
export const REVIEW_WINDOW_DAYS = 30;
