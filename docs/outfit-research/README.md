# Automated outfit research and reviewed draft import

**Latest status:** see [local atomic-save corrective review](atomic-save-review.md), [revised migration proposal](index-migration-plan.md), [prior security/database review](final-review.md) and [dependency decisions](dependency-review.md). The final review includes authorized read-only Atlas inspection and targeted local security fixes; it did not enable or write production imports.

Implemented locally on `feat/outfit-research-import`, in `D:\celebritypersona-outfit-import`. Research → reviewed JSON preview → selected fields in the existing New Outfit form → separate, confirmed Save as Draft. No real outfit has been researched or created during implementation.

## Verified architecture audit

The code uses TypeScript content types and the MongoDB driver, not Mongoose models. `lib/validation.ts` provides runtime form validation. `saveOutfit` authenticates, canonicalizes celebrity/occasion names, parses the form, checks slug conflicts, maps the lead piece, preserves link history and runs SEO checks before calling the mutation layer. Calling a database insert directly would bypass those protections.

The required fields for **either** a valid draft or publication submission are:

| Field | Existing validation |
| --- | --- |
| `celebrity` | Nonempty trimmed name |
| `event` | Nonempty trimmed description of the actual event/context |
| `occasion` | Nonempty primary occasion; also included in `occasions` |
| `date` | Real calendar date in YYYY-MM-DD; not automatically the post date |
| `slug` | Nonempty lowercase letters/numbers with single hyphens; unused by another look |
| `status` | Explicit `draft` or `published`; imported New forms are locked to `draft` |
| `items` | At least one piece with a nonempty `name` |

Remaining outfit inputs, including their constraints:

| Input | Draft behavior |
| --- | --- |
| `occasions` | Optional additional names; normalized/deduplicated with primary first |
| `seoTitle`, `seoDescription` | Optional; maximum 60 / 160 characters |
| `photoCredit` | Optional at schema level, maximum 120; publishing needs a specific attribution for every photo |
| `images` | Defaults to `[]`; each supplied image needs HTTP(S) `url` and nonempty storage `path`; optional `alt` max 160 and per-photo `credit` max 120 |
| `notes` | Optional nonempty paragraph strings |
| `primaryKeyword` | Optional, max 80; normalized lowercase/single spaces |
| `secondaryKeywords` | Optional, max 5, max 80 each; normalized/deduplicated |
| `faqs` | Optional; both question and answer or neither; max 200 / 1200 |
| `leadPiece` | Optional form row selection; maps to stored `leadPieceId` |

Each piece supports `id` (generated if missing), `name`, original `wornBrand`, `worn`, `wornUrl`, swap `swapBrand`, `swap`, `swapUrl`, per-side retailer/affiliate URL/network/status, `note`, `soldOut`, hotspot X/Y, category and colours. Prices, if present, are **positive whole INR numbers**. URLs must be HTTP(S). Both hotspot coordinates must be supplied together, in 0–100. Categories/colours must be from `lib/taxonomy.ts`. Link networks/statuses come from `lib/types.ts`; missing choices normalize to `none` / `unverified`. The form's flat link fields become embedded `wornLink` / `swapLink` records. Original and swap products are embedded pieces, not separate product collections. Fabric, currency, source claims and product-match classification previously had no dedicated outfit fields; the new research provenance retains them without inventing application fields.

The server supplies outfit ID, piece IDs and totals. Existing ordinary saves stamp `pricesCheckedAt`; imported creation deliberately does not claim that every price was checked today. First publication sets `publishedAt` and `slugLockedAt`; neither is set on imported draft creation. Edits retain existing source history and slug-lock behavior.

Image-free drafts already passed server validation. The browser's photo-credit field was nevertheless always required; it is now required only for published forms. Publication's photo/credit checks are unchanged. Images are uploaded manually through the authenticated Firebase upload route (JPEG/PNG/WebP/AVIF, actual signature checked, maximum 6 MB). The importer neither downloads nor uploads images and preserves all current photos.

`seoChecks` blocks **first publication**, not draft saves: primary keyword, its meaningful words in title/H1 and slug, at least one photo, alt on every photo, specific photo credits, selected lead piece, category on every piece, 150+ original About words, no conflicting published primary keyword, and a swap or confirmed original price. Warnings include intro/meta keyword use, lengths, currency, missing swaps/accessory rows and fewer than two occasions. `buildReview` adds editorial checks for generic/repeated copy, relevance, product/link checks, FAQs and internal hubs. These rules were not changed. Existing published edits retain their previous warning behavior.

Public outfit reads filter `isPublished`; an explicit draft stays private regardless of its price. Existing admin preview at `/admin/preview/<id>` requires authentication. An absent legacy status can be treated as published; imported records always carry `draft` explicitly.

The current ordinary create mutation inserts the outfit, then creates missing celebrity/occasion/brand records. Name matching ignores case and surrounding whitespace. Missing celebrities/brands are blank named hubs; a missing occasion defaults to Everyday with blank descriptive fields. That ordinary path is not transactional and uses max-ID-plus-one allocation. The new imported path stays behind `saveOutfit`/`createOutfit`, reuses the existing missing-record and blank-record helpers, and makes the outfit and approved related inserts one transaction. It never edits existing hubs or existing outfits.

Existing duplicate prevention mainly checks slugs in application memory and primary keyword overlap. Slug suggestions use celebrity/piece/brand with date/numeric collision suffixes; this is a suggestion, not identity verification. Source post URLs were not historically stored as outfit identity. Link status `ok` means the checker received an acceptable response, not that the celebrity wore that exact product. A 403/429 is unverified, not sold out. `scripts/check-links.ts` is not invoked by this import.

Maintenance scripts opt into remote writes explicitly; `next dev` blocks remote writes unless overridden. The final review extended the shared guard to remote writes in Vercel previews, which run production-mode Node. Imported persistence additionally rejects previews and requires both `VERCEL_ENV=production` and `CP_OUTFIT_IMPORT_WRITES=enabled` for remote saves. No production setting was changed. The initial implementation used no production credentials/database; the final review performed only the separately authorized read-only Atlas audit. Cloudflare/Slack automation, PostHog and Search Console were untouched.

## Format and research

`cp-outfit-research/1` has `inputs`, `researchedAt`, `sources`, `claims`, `seo`, `missing`, `warnings`. Every claim has `{value, status, sourceIds, note}`; `status` is verified/inferred/unknown and unknown values are null. Verified claims require at least one existing source ID. Sources retain public HTTPS URL, lookup date, title and a short quote. Claims cover celebrity, post date, actual outfit date, event, occasion, brand, retailer, product name/category/colour/fabric/description, price/currency, stock, exact/similar/unconfirmed match and photo credit. SEO contains candidate keywords with relevance rationale and unknown demand, intent, title, description, slug, paragraphs, identification explanation, optional FAQs, alt suggestions and internal links. The strict schema is in `lib/outfit-research.ts`; the complete synthetic example is `tests/outfit-research-fixtures.mjs`.

The intake CLI makes an all-unknown `research.json` and reusable `prompt.md` in an explicitly selected external folder. It performs **no web request**. Open that folder in Codex with public web search enabled and ask it to follow the prompt. Codex opens the public sources, researches the exact look and writes the JSON. No API keys or automated access to Instagram are required. The website importer does not fetch user-supplied URLs.

Retailer pages may establish product names, fabric, colour, stated price/currency and time-sensitive variant availability. Those facts do not independently prove celebrity identity or an exact product match. Instagram identity/caption/date/credits are available only if the public source is accessible and explicit. If blocked, ask for caption, screenshot or additional context; do not bypass access controls. Fabric cannot be established from appearance alone. Event, worn date, original match, rights and pricing gaps require manual review. Source authenticity cannot be proven by JSON validation. Never fabricate missing facts to satisfy a required field.

Inferred fields are off by default and require a separate confirmation before they are offered. Original brand/link/retailer require a verified exact match. Original price additionally requires verified INR and a positive whole amount. Foreign-currency/fractional prices remain evidence and require manual resolution; no exchange rate or rounding is invented. Imported product links always begin unverified. Stock evidence does not automatically set a buyability status. FAQs and About copy remain proposals requiring editorial review.

## One-outfit usage, after implementation review

1. In this feature worktree, prepare a fresh external research folder:

   ```powershell
   npm.cmd run outfit:research -- init --instagram "<Instagram post URL>" --product "<original retailer product URL>" --out "C:/Users/rabin/celebritypersona-research/<new-look>/intake"
   ```

2. Open only that `intake` folder in Codex and say: **Read prompt.md and research the two inputs in research.json.** Supply a caption/screenshot when requested. Review the resulting evidence; the initializer never overwrites existing research.
3. Open the application configured for an explicitly disposable **local MongoDB replica set**, using synthetic/local data and no production `.env`. The verification harness below supplies an isolated example. Do not test writes against a Vercel preview.
4. Admin → Outfits → New → Import outfit research. Upload `research.json` or paste it, then Preview research. Review all claims, linked evidence, missing fields and duplicate candidates. Restore or discard any pre-existing browser draft first.
5. Check only the field groups you approve. Selected pieces/FAQs replace those groups; unchecked fields, images and unrelated edits are preserved. Confirm the review and Apply approved fields. This only changes the unsaved form and browser autosave.
6. Complete actual event/date/occasion and any other mandatory gaps. The save control lists schema errors. Images, photo permissions/credit and alt text remain manual work; SEO publication blockers can remain on a draft. Inspect the live SEO Research Assistant. It continues to handle demand evidence and the Claude/Codex workflow separately.
7. Approve any **listed** new celebrity/occasion/brand records, approve the completed draft, then click **Save as Draft**. The server repeats validation and duplicate checks. Saving is intentionally refused if the reviewed uniqueness indexes or transaction support are absent. No production index setup is included.
8. Open the saved draft editor or admin preview, inspect retained research evidence, upload permitted images, correct details, finish SEO checks and publish manually when satisfied. Importing itself cannot update an existing outfit.

The first real outfit still requires the user's supplied URLs and approval. None has been created.

## Persistence, duplicates and SEO integration

Same canonical Instagram post blocks import; post/reel aliases with tracking resolve to the same identity. Same retailer URL, same celebrity/category and existing slugs are surfaced for review across drafts and published looks. Product canonicalization removes selected tracking parameters, preserves variant queries, and does not resolve redirects automatically. A reused product can belong to different legitimate outfits, so product reuse warns rather than globally blocking. Historical post matches cannot be detected where URLs were never stored. Variants, alternate retailer URLs and reposts still need human judgment.

The approved research, selected groups, source identities, import timestamp and editor identity are retained on the outfit. A deterministic import document identity and unique canonical post index prevent repeated imported creation. Retries never update a prior draft or a look that has since been published. Unique outfit IDs/slugs and case-insensitive hub names make concurrent conflicts fail safely. Snapshot/majority transactions roll back all related inserts on failure. The application never creates these indexes during a save. The read-only audit found six missing indexes and no blocking duplicates; the proposed additive index migration and remote-write enablement need separate approval. Preview import performs zero writes to any collection, including `seoReviews`.

Existing SEO research stays mounted separately. Draft autosave now carries the import envelope. Research already being edited is not silently overwritten. Changing the slug changes its prepared research key, so review/save existing research before applying a replacement slug. Existing fingerprints reject stale dual-AI results; copied suggestions still require selection and separate saves. Once a form is populated, its existing research-pack export can be used unchanged with `seo:research init/check/challenge/compare`. This intake does not replace that workflow or imply two-model agreement verifies a fact.

## Verification and rollout boundary

Run:

```powershell
npm.cmd run test:outfit-workflow -- --mongod "C:/path/to/mongod.exe"
```

The harness refuses local `.env` files, strips inherited application secrets, starts its own loopback-only replica set on port 27139, checks ownership by MongoDB process ID, uses uniquely named disposable databases and synthetic records, runs the complete automated suite, ESLint, production build and TypeScript, then starts localhost port 3097 and runs headless Chrome. Browser requests outside localhost are blocked. Indexes are provisioned only in the disposable database. Services stop and the application database is dropped afterwards. Temporary MongoDB logs/files remain in the printed OS temporary folder. Chrome must be installed; the MongoDB binary is supplied explicitly. This is a test harness, not a production bootstrap command.

Tests cover strict/malicious JSON, URL validation, inaccessible Instagram/unknown required facts, source/date checks, inferred prices, exact versus similar matches, INR handling, selective preservation/repeat imports, duplicates, publication refusal, Vercel preview refusal, missing indexes, concurrent retries, rollback after related-record failure, unchanged existing outfits, explicit approval and actual mobile/desktop UI/autosave behavior. See `verification.md` for results and screenshots.

Before rollout: review this branch, approve commit separately, approve and validate the index migration against read-only catalog/index evidence, verify replica-set transaction support and target environment, then authorize deployment separately. No real write is authorized by running local tests. Human source verification, current stock/price checks, image rights, editorial quality and publication remain required. Evidence schemas validate shape and references, not truth. The current max-ID allocation can encounter concurrent conflicts; unique indexes keep them safe, and retries may be necessary.

Future batches of 5–20 Sheet rows can produce one isolated research file and stable source identity per row, with a read-only input manifest and per-row review/status. Reuse the same preview, deduplication and single-record save path. Research can be bounded by retailer rate limits and cached public evidence, with failures isolated per row. No Google Sheet connection or bulk production-write mechanism is implemented here.
