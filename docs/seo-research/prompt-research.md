# CelebrityPersona SEO research — {{TITLE}}

You are researching one celebrity outfit page before a human editor decides whether to publish it. Pack: `{{KEY}}`, fingerprint `{{FINGERPRINT}}`. Read `pack.json` in this folder ({{SIDE}}). `pack.md` is the same pack for people; use `pack.json`.

{{INDEPENDENCE}}

{{RULES}}

## What to do

**A. Facts.** For every entry in `pack.json` → `checks`, decide `confirmed`, `contradicted` or `unverifiable`, with sources.
- Brand, price and retailer: check the linked retailer page first (`pieces[].links`). Prices in ₹; say if a sale price or sold-out notice is showing.
- Product match: `confirmed` only when a source shows it is the same item — the retailer's photos and description match the piece, or the celebrity, stylist or brand names it. A similar item is `contradicted` or `unverifiable`, never `confirmed`.
- Event, date and photo credit: prefer the account named in the photo credit, the brand's or celebrity's own posts, then reputable news.
- Add up to 30 `additionalFacts` (X1, X2…) only for important facts the pack lacks — for example the brand of a piece that has none — each with sources.

**B. Search intent.** What does someone searching for this look want — to identify the outfit, to buy it, inspiration, or news about the event? Explain from what your web search shows.

**C. Keywords.** Up to 20, lowercase, built from facts in the pack or facts you verified: celebrity + garment + colour, brand + product name, event + outfit, and so on.
- Choose exactly one `primary` (or none, if nothing fits), and `secondary` / `related` ones; mark tempting but wrong ones `rejected` and say why (wrong colour, wrong garment, about a different look, too broad).
- Check `pack.json` → `site.publishedLooks`: a keyword another published look already targets is a risk; say so.
- Demand stays `unknown` unless a page you opened shows a figure (ground rule 5).

**D. Competition.** For up to 10 keywords, what kinds of pages your web search tool shows (outfit-identification sites, news, retailers, Instagram, video), what they include that this look does not, and sources. Never claim positions or ranking chances.

**E. Recommendations.** Up to 30 (R1, R2…), each with area, severity, the issue, the fix and, where useful, copy-ready text.
- `pack.json` → `audit` is the site's own checklist: do not repeat it item by item; add what it cannot see (facts, intent, competition, missing information readers want).
- Severity `high` only for a wrong fact, a keyword that does not match the look, or something that would mislead a reader.

**F. Gaps.** What you could not check, and why.

## Finish

1. Write `findings.json` (format below) with `"tool": "{{TOOL}}"`, `"pass": "{{PASS}}"`.
2. Re-read it against the rules and the format; fix anything that does not fit.
3. Tell the editor: "Done. Run `npm run seo:research -- check {{SLUG}}` in the website folder." Do not do anything else.

{{FORMAT}}
