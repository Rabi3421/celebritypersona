## Output: `findings.json`

Write exactly one JSON object, in this shape, to `findings.json` in this folder. No comments, no trailing commas, no extra fields — unknown fields make the file invalid. Keep every list within its limit.

```json
{
  "schema": "cp-seo-findings/1",
  "tool": "{{TOOL}}",
  "pass": "{{PASS}}",
  "pack": { "key": "{{KEY}}", "fingerprint": "{{FINGERPRINT}}" },
  "completedAt": "YYYY-MM-DD",
  "searchIntent": {
    "primary": "identify-outfit | buy | style-inspiration | celebrity-news | unclear",
    "secondary": ["up to 3 of the same values"],
    "explanation": "≤600 chars: what a person searching for this look wants, and why you think so",
    "sources": [{ "url": "https://…", "accessedAt": "YYYY-MM-DD", "title": "≤200", "quote": "≤300" }]
  },
  "checks": [
    {
      "id": "F1",
      "status": "confirmed | contradicted | unverifiable",
      "finding": "≤600 chars: what you found",
      "correctedValue": "optional, ≤200: the value the source shows instead",
      "sources": [{ "url": "https://…", "accessedAt": "YYYY-MM-DD", "quote": "≤300" }]
    }
  ],
  "additionalFacts": [
    {
      "id": "X1",
      "about": "look | P1 | P2 …",
      "field": "event | date | photo-credit | brand | price | retailer | product-match | swap-brand | swap-price | other",
      "claim": "≤400 chars",
      "status": "confirmed | contradicted | unverifiable",
      "sources": []
    }
  ],
  "keywords": [
    {
      "keyword": "lowercase phrase, ≤80 chars",
      "role": "primary | secondary | related | rejected",
      "intent": "identify-outfit | buy | style-inspiration | celebrity-news | unclear",
      "rationale": "≤600 chars: why it fits this exact look (or why rejected)",
      "demand": { "status": "unknown", "note": "optional, ≤300" },
      "risks": ["≤200 chars each, up to 5"]
    }
  ],
  "competition": [
    {
      "keyword": "lowercase phrase",
      "method": "tool-web-search",
      "observations": ["≤300 chars each, up to 8: what kinds of pages appeared and what they cover"],
      "sources": []
    }
  ],
  "recommendations": [
    {
      "id": "R1",
      "area": "keyword | title | description | url | content | products | pricing | faqs | images | links | structured-data",
      "severity": "high | medium | low",
      "issue": "≤400 chars",
      "fix": "≤600 chars",
      "copy": { "field": "seoTitle | seoDescription | primaryKeyword | faq | notes | imageAlt", "text": "≤1200 chars" },
      "sources": []
    }
  ],
  "challenges": [],
  "gaps": [{ "area": "facts | intent | competition | keyword | title | … ", "note": "≤400 chars" }]
}
```

Rules the checker enforces:

- `checks` answers **every** id in `pack.json` → `checks`, once each. `confirmed` or `contradicted` needs at least one source; without a source the answer is `unverifiable`.
- At most one keyword has `role: "primary"`. Keywords are lowercase and unique.
- Observed demand, when a page you opened shows it, replaces the `unknown` object with all of: `{ "status": "observed", "sourceName": "…", "url": "https://…", "value": "exactly as shown", "period": "…", "market": "IN", "collectedAt": "YYYY-MM-DD" }`. Anything that reads like an estimate ("~500", "about 1K") is refused.
- Free text that states search volumes, visits, clicks, keyword difficulty, ranking chances or "will rank" is refused.
- `copy` is optional and must read naturally. Title ≤60 characters, description 70–160, the primary keyword at most once.
- Limits: checks 200, additionalFacts 30, keywords 20, competition 10, recommendations 30, gaps 20, sources 8 per item.
