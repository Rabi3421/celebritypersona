import { wordCount, MIN_HUB_LOOKS, MIN_INTRO_WORDS, isThinHub } from "@/lib/indexing";
import { dollarsOnly, missingWords } from "@/lib/outfit-seo";
import { clampDescription } from "@/lib/seo";
import type { SeoCheck } from "@/lib/seo-checks";
import type { HubSeo } from "@/lib/types";

/**
 * Search appearance for hub pages — celebrity, occasion, brand and budget.
 *
 * The page's own generated title and description stay the fallback; an
 * editor's wins when set. Descriptions quoting $ without ₹ are passed over, as
 * on the outfit pages.
 */
export const hubTitle = (record: HubSeo | undefined, fallback: string) =>
  record?.seoTitle?.trim() || fallback;

export function hubDescription(record: HubSeo | undefined, fallback: string) {
  const own = record?.seoDescription?.trim();
  return clampDescription(own && !dollarsOnly(own) ? own : fallback);
}

/**
 * The hub checklist. Nothing here blocks a save — hubs have no draft state —
 * but it is the same shape as the outfit checklist, and the thin-page check
 * says exactly why a page is out of the index.
 */
export function hubChecks(input: {
  keyword?: string;
  title: string;
  description: string;
  intro: string[];
  looks: number;
}): SeoCheck[] {
  const keyword = input.keyword?.trim();
  const words = wordCount(input.intro);
  const missing = (text: string) => missingWords(text, keyword);
  const list = (items: string[]) => items.join(", ");
  const check = (id: string, level: SeoCheck["level"], ok: boolean, label: string, detail?: string): SeoCheck => ({
    id, level, ok, label, ...(ok ? {} : { detail }),
  });
  const thin = isThinHub({ looks: input.looks, introWords: words });

  return [
    check(
      "indexable",
      "critical",
      input.looks > 0 && !thin,
      "In the index",
      input.looks === 0
        ? "No published looks yet."
        : `Thin: ${input.looks} ${input.looks === 1 ? "look" : "looks"} and a ${words}-word intro. ${MIN_HUB_LOOKS} looks, or ${MIN_INTRO_WORDS}+ words of intro, puts it back in.`,
    ),
    check("keyword", "critical", Boolean(keyword), "Primary keyword set", "Add the phrase this page should rank for."),
    check("keyword-title", "critical", Boolean(keyword) && missing(input.title).length === 0, "Keyword in the title",
      keyword ? `Missing: ${list(missing(input.title))}` : "Set a primary keyword first."),
    check("intro", "critical", words >= MIN_INTRO_WORDS, `Intro has ${MIN_INTRO_WORDS}+ words`, `${words} of ${MIN_INTRO_WORDS}. The generated bio does not count.`),
    check("keyword-intro", "warning", Boolean(keyword) && missing(input.intro[0] ?? "").length === 0, "Keyword in the first paragraph",
      keyword ? `Missing: ${list(missing(input.intro[0] ?? ""))}` : undefined),
    check("keyword-description", "warning", Boolean(keyword) && missing(input.description).length === 0, "Keyword in the description",
      keyword ? `Missing: ${list(missing(input.description))}` : undefined),
    check("title-length", "warning", input.title.length <= 60, "Title 60 characters or fewer", `${input.title.length} characters.`),
    check("rupees", "warning", !dollarsOnly(`${input.description} ${input.intro.join(" ")}`), "Prices in ₹, not $", "A $ amount with no ₹ amount."),
  ];
}
