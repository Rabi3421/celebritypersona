> Corrective update: ordinary saves, related writers and the migration prerequisites have since changed locally. See [atomic-save-review.md](atomic-save-review.md) and the revised index plan. Earlier test counts and ordinary-save conclusions below describe the prior phase only.

# Final security, database and implementation review

14 November 2026 · `feat/outfit-research-import` · `D:\celebritypersona-outfit-import`

**Local review and fixes are complete. Production enablement is not approved.** The workflow passes its local checks, but rollout still needs the six additive indexes, a decision on residual dependencies, review/commit/deployment approval and a separately approved first real draft save. No commit, push, deployment, production index/record mutation or external automation change was made.

## Database findings and migration requirement

Read-only Atlas inspection reports **MongoDB 8.0.37, a replica set, logical sessions, max wire version 25**, and ordinary uncapped/non-timeseries collections. That topology supports the Node driver's multi-document transaction mechanism. The imported path now explicitly uses primary reads, snapshot read concern and majority write concern. These are supported transaction settings according to [MongoDB's documentation](https://www.mongodb.com/docs/manual/core/transactions/). Production write/commit behavior was deliberately not probed; operational permissions, load and deployment configuration still require the approved pilot.

| Collection | Documents | Existing relevant indexes | Duplicate/readiness findings |
| --- | ---: | --- | --- |
| outfits | 16 | Native `_id_`; unique `id_1` | No duplicate IDs, stored/effective slugs or imported post keys; all IDs valid; every slug stored; no imported records yet |
| celebrities | 14 | Native `_id_`; unique `id_1` | No normalized or target-collation name duplicates; names trimmed; IDs valid |
| occasions | 16 | Native `_id_`; unique `id_1` | Same checks pass |
| brands | 19 | Native `_id_` only | Same checks pass, but numeric ID uniqueness index missing |
| seoReviews | 0 | Native `_id_`; unique `key_unique` | No duplicate keys; separate research store already indexed |

The application requires nine custom uniqueness guarantees for imported creation. Three already exist and are accepted by semantic definition. **Six are missing:** outfit slug; canonical imported Instagram source; brand numeric ID; case-insensitive celebrity name; case-insensitive occasion name; case-insensitive brand name. No optional performance index is needed for this catalog size or the current in-memory lookup implementation.

An **index-only migration is genuinely required** before enabling the implemented production save path. A document migration/backfill, MongoDB upgrade, new collection, credential, celebrity merge, slug rewrite or existing-look change is not required by the inspected data. Full definitions, operator sequencing and rollback commands are in [the proposed index plan](index-migration-plan.md). None was executed. Recheck duplicates immediately before any later approval is used.

Evidence: [before](database-audit-before.json), [after](database-audit-after.json), [comparison](database-audit-comparison.json). Document SHA-256 hashes, counts and index definitions are identical across all five inspected collections. The before report's native `_id_` uniqueness is normalized to MongoDB's intrinsic guarantee; there was no index alteration.

**Credential limitation:** the audit script loaded the existing local server environment in its own process and issued only read commands. It never printed a URI, password, user identity, document body or role definition, and it never imported application mutation code. Effective privileges nevertheless include writes, so this was read-only *execution*, not a database-enforced read-only credential. No research-facing database endpoint or credential was created or given to an AI research folder. Future audits should use an operator-managed dedicated read-only identity; no identity or permission was created/changed here. Do not interpret prompt restrictions or this script as a security boundary against arbitrary code execution.

## Security findings and local fixes

| Finding | Local resolution and validation |
| --- | --- |
| `saveOutfit` authenticated but read catalog data before returning a signed-out response | Moved the signed-out return before catalog reads. Anonymous action replay returns session-expired state and writes nothing. Session authentication still checks the configured admin identity and revocation state. |
| Framework CSRF protections should have explicit application coverage | Added a same-origin browser mutation check before catalog reads. Missing/null/malformed/cross-site origins are refused; forwarded-host handling remains compatible with the existing proxy. Real cross-origin action replay is also rejected by Next before dispatch. See [Next's Server Actions security settings](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions). |
| Only the initial imported save guarded Vercel previews; later ordinary edits/research saves could still reach the remote DB | Shared database write guard now rejects remote writes in Vercel previews regardless of `NODE_ENV=production` or the dev opt-in. All currently used application mutation methods go through the guarded DB; imported raw-client transactions have their own preview check too. This is defense in depth, not replacement for database roles. |
| A local production-mode process could otherwise use remote import credentials | Remote imported saves now require both `VERCEL_ENV=production` and `CP_OUTFIT_IMPORT_WRITES=enabled`. Local disposable databases remain testable. The setting was not changed on Vercel or anywhere else. It provides an explicit deployment gate and import kill switch. |
| Byte/schema limits alone leave unnecessary work/error amplification on malformed JSON | Added pre-schema node/depth/array bounds and bounded diagnostic output. Unknown/prototype keys, unsafe URLs, bad source references, oversize files and future lookup dates remain refused. Fixed malformed retailer-URL handling so it returns a validation result instead of an incidental URL exception. |
| Shared JSON-LD serializer did not escape script-closing content | Escaped `<` in serialized JSON-LD. A title/event/piece value containing `</script>` cannot break out into executable markup after manual publication; JSON parsing still yields the original content. This fixes an existing shared serialization weakness, without changing SEO rules or any stored data. |
| Existing framework/schema/transitive vulnerabilities were present before this feature | Applied targeted security updates; see dependency section. No forced/major dependency upgrade was performed. |

Import preview is a client-side, data-only component behind the authenticated admin page. It has no server action, fetch, database capability, storage upload, publication or related-record creation. The actual save remains the existing authorized application action, not a new public import endpoint. Internal persistence is not an independently exposed HTTP action.

Research evidence and copy are rendered as React text. Sources are validated HTTPS anchors, not HTML; no imported HTML is evaluated. The browser test supplies executable-looking HTML and a “publish now” prompt injection in a source note; it remains inert text and the saved record remains a draft. External research URLs are never fetched by the importer/server, so this feature adds no arbitrary URL fetch/SSRF path. The existing Next image path also receives the targeted dependency updates, but these conclusions do not claim that every possible website SSRF vector has been independently penetration-tested.

Server-side import approval rejects an existing outfit ID, any published status, absent confirmation or invalid selection envelope. Imported New forms lock status to draft. The final save approval resets after a form change; approval for related inserts is bound to the exact current missing-record list. Changed names invalidate that approval. Saved editors display original evidence but have no new-record importer. Publication remains a deliberate manual action through the unchanged SEO gate.

## Data, SEO and maintainability review

The architecture remains consistent with the site: pure shared validation/proposal functions; existing form snapshot/autosave and repeated-row components; a client preview; the authenticated `saveOutfit`/`createOutfit` path; existing taxonomy, missing-record helpers and SEO functions; and a focused transactional repository for the multi-document imported write. A dedicated HTTP import endpoint, direct AI/MongoDB writer, scraping service, new account system and bulk queue are unnecessary for this milestone and were not added.

Verified/inferred/unknown are retained per claim with sources and lookup dates. They describe the researcher's evidence assessment, not a machine certification of truth. Exact original match, currency and price are treated separately; an unconfirmed/similar match is never populated as the original. Inferred fields require explicit confirmation before selection; original price additionally needs verified exact match, verified INR and a safe positive integer. Fractional/foreign/unknown prices are not rounded, converted or invented. Fabric stays research evidence unless supported copy is approved. Post date is never silently used as worn date. Event/date/occasion/celebrity/slug/piece gaps remain visible and block saving when mandatory.

Keywords carry relevance rationale, with demand fixed to unknown in this intake. Existing metric-fabrication checks are reused. Actual recorded demand stays in the separate SEO Research Assistant. Originality, source truth and subtle keyword stuffing cannot be conclusively established by a schema; the existing live review flags generic/repeated copy and the editor still reviews the content. No SEO publishing rule, word threshold, photo requirement, keyword uniqueness rule or original-versus-swap display was weakened. Sparse but accurate research can remain a valid draft with publication blockers.

Unselected form groups and photos survive import and reload. Selecting the items/FAQ group deliberately replaces that group, after preview/approval; it does not append duplicate rows. Existing SEO research remains separately mounted/saved; changing a prepared slug changes its research key and can invalidate old AI fingerprints. The intake does not auto-attach, overwrite or silently accept existing Claude/Codex research. Human image uploads, photo rights, credits and per-image alt review remain manual.

## Duplicate, transaction and failure results

- Post/reel/tracking variants map to a canonical Instagram identity. A deterministic native document ID plus a unique canonical-post index prevents a second imported record. The transaction rechecks current records/slug; concurrent first saves and repeated attempts produce only one outfit and one set of related hubs. A retry never rewrites a record that an editor has since published.
- Reused retailer URLs, celebrity/category similarity and slug conflicts are surfaced for review across drafts and published looks. Product reuse can be legitimate and therefore warns; it is not globally prohibited. A legacy outfit without stored Instagram identity cannot be definitively matched by post. Reposts, multi-look carousels, alternate retailer URLs and product variants still require human judgment.
- Missing index guarantees fail before any insert. Missing approval, malformed payloads, publication attempts and slug conflicts leave existing data unchanged.
- A disposable MongoDB validator rejects the second new brand after the transaction already inserted the outfit, celebrity, occasion and first brand. All those inserts roll back; counts and existing documents remain unchanged. Separate failure after an earlier related insert also rolls back. No orphaned related record is retained.
- Unique constraints make conflicts with ordinary concurrent writers fail safely for the imported transaction. The legacy ordinary mutation/rename paths are still not multi-document transactions; do not combine an import pilot with unrelated rename/merge maintenance. An ambiguous commit/network response can mean a complete commit succeeded: the UI advises checking the list, and duplicate protections make retry safe.
- Same-post re-import is blocked in the UI, repeated authenticated action replays leave one draft, and cross-origin/anonymous/tampered-published requests leave the draft and existing look unchanged.

## Dependency results

All **18 initial vulnerable package entries were pre-existing**, not introduced by Playwright. Initial severity: **1 critical, 10 high, 7 moderate**. Targeted local changes: Next **16.3.3 → 16.4.6**, Zod **4.5.2 → 4.6.6**, sharp **0.35.4 → 0.35.5**, source-map-js **1.2.1 → 1.2.2**, re2js **2.8.6 → 2.8.7**, brace-expansion **1.1.18 → 1.1.21** and **5.0.9 → 5.0.12**, plus matching Next platform support packages.

Current result: **12 entries, 0 critical, 5 high, 7 moderate**; production-installed subset: **5 high**. The remaining high entries are Nodemailer and four inherited Firebase/gRPC entries. The seven moderate entries are dev-only TypeScript-ESLint/minimatch. [The dependency report](dependency-review.md) lists every affected package, exposure, advisory links, fixes and justified conditional deferrals. No Firebase downgrade, forced override, Nodemailer major upgrade, live mail test or PostHog change was made.

Firestore/gRPC is unused by source imports and absent from generated runtime route traces, supporting a conditional deferral for the current storage-only build. Dev glob tooling can be deferred for controlled source inputs pending an upstream-compatible fix. Nodemailer needs a separate upgrade/mail review or an explicit operator-verified risk decision; actual production API-versus-SMTP configuration was not inspected. Passing these local tests is not approval to ignore residual advisories.

## Complete synthetic workflow and checks

Final local run: **127 automated tests passed, 0 failed, 0 skipped; 1 Chrome end-to-end test passed; TypeScript passed; production build passed on Next 16.4.6 (53 static pages); ESLint 0 errors with the existing `tests/ai-research.test.mjs:308` warning.** `git diff --check` passes. The expected cross-origin security rejection logs an Invalid Server Actions request during the test; it is an asserted successful rejection, not a failing workflow.

The browser test now starts with two synthetic URLs, invokes the offline initializer into a fresh external folder, verifies the generated unknown-valued JSON/prompt, writes valid synthetic researcher output, and uploads that JSON through the actual importer. This fixture writer stands in for Codex; it does not claim to test a model's research accuracy or fetch a real Instagram/retailer page.

It previews evidence/missing information, applies selected fields, preserves a manually entered event and a manually chosen synthetic pixel photo/alt, leaves unknown worn date blank, completes that date, verifies approvals, saves one draft, checks related records, reopens the editor/evidence, checks SEO review, confirms the public outfit URL is 404 and the slug is absent from public outfits/sitemap/search/llms output, confirms admin preview has a noindex header, replays rejected/duplicate saves, then re-imports the same post and observes the block. Firebase upload responses are mocked only in this browser test; no storage bytes or copyrighted photographs were uploaded. Separate unit/database tests verify image-free drafts too.

The harness strips inherited application secrets, refuses local production environment files, starts an owned loopback-only disposable replica set, uses uniquely named synthetic databases, and stops services/drops its application test database. Final passing run used temporary folder `C:\Users\rabin\AppData\Local\Temp\cp-outfit-verification-1hkwOy`. Synthetic logs/intake folders remain in the OS temporary directory. Production was accessed only by the separately reviewed read-only audit script.

Screenshots: [desktop](screenshots/desktop-review.png), [mobile evidence](screenshots/mobile-review.png), [mobile populated form](screenshots/mobile-form.png). Synthetic content only.

## Files changed during this final review

Application/security changes:

- `app/admin/(panel)/outfits/actions.ts`
- `lib/admin-request.ts` (new)
- `lib/db/imported-outfits.ts`
- `lib/dev-write-guard.ts`
- `lib/db-guard.ts` (documentation correction)
- `lib/outfit-research.ts`
- `lib/seo.ts`
- `package.json`, `package-lock.json`

Tests/audit tooling:

- `tests/dev-write-guard.test.mjs`
- `tests/outfit-security.test.mjs` (new)
- `tests/outfit-import-db.test.mjs`
- `tests/browser/outfit-import.spec.mjs`
- `scripts/audit-outfit-database.mjs` (new, reads only; local report output)
- `scripts/audit-outfit-dependencies.mjs` (new)

Reports/artifacts:

- `docs/outfit-research/final-review.md`, `index-migration-plan.md`, `dependency-review.md`
- `docs/outfit-research/database-audit-before.json`, `database-audit-after.json`, `database-audit-comparison.json`
- `docs/outfit-research/dependency-audit-before.json`, `dependency-audit.json`
- `docs/outfit-research/README.md`, `changes.md`, `verification.md`
- All three `docs/outfit-research/screenshots/*.png` files were refreshed by browser testing.

Ignored `.scratch` comparison/failure diagnostics and normal dependency/Next/TypeScript build output were generated locally. Homepage Studio's staged files in `D:\celebritypersona` and the clean BI Dashboard worktree remain unchanged. No branch was reset, stashed, merged or committed.

## Deployment prerequisites and exact first-pilot sequence

1. Review these local changes and approve a commit/merge separately, coordinating with the other worktrees. Resolve or explicitly accept the residual dependency decisions in `dependency-review.md`. Rebuild/retest the actual eventual merged source; this review did not integrate staged Homepage Studio or BI work.
2. Approve the six-index migration separately. An operator performs the fresh read-only checks, backup, paused-write window, creation ledger and verification in `index-migration-plan.md`. No data backfill or cleanup is included. Keep imported writes disabled.
3. Separately approve deployment of the reviewed source/dependency lockfile with the import flag disabled. Verify admin authentication/read-only preview and existing manual editing. Preview deployments with a remote DB remain read-only, including authentication timestamp writes; use an isolated database for interactive preview testing rather than opting them into production.
4. Separately approve enabling `CP_OUTFIT_IMPORT_WRITES=enabled` only on the production deployment. No setting was changed during this review. Verify target database/session/index readiness through the approved application/operator pathway, not credentials pasted into Codex.
5. Supply the pending outfit's public Instagram post and original retailer URLs. From this worktree prepare the isolated research folder:

   ```powershell
   npm.cmd run outfit:research -- init --instagram "<Instagram post URL>" --product "<original retailer product URL>" --out "C:/Users/rabin/celebritypersona-research/<new-look>/intake"
   ```

6. Open only that intake folder in Codex and ask it to follow `prompt.md`. Use an actual filesystem/tool boundary with no credentials/signed-in connectors; the prompt alone is not a security sandbox. Public web research only. Supply caption/screenshots when Instagram is inaccessible. Leave unsupported identity/event/worn-date/product/price facts unknown. No real outfit was researched in this review.
7. In the deployed Admin → Outfits → New, preview the resulting `research.json`. Review each source, exact product/variant, current INR price/stock and duplicate candidates, especially historical records without stored Instagram identity. Restore/discard an existing browser draft before applying. Record expected existing outfits and proposed new related names for the pilot.
8. Select approved groups, apply them to the unsaved form, complete mandatory gaps from actual evidence and inspect SEO warnings. Keep images/manual alt/rights work under your control. Do not invent an event/date just to enable saving. If required facts remain unavailable, keep the research preview unsaved.
9. Separately approve the first real draft write, approve the completed form and exact new-record list, then explicitly click **Save as Draft**. Confirm its ID, source identities, draft status and related records; existing records must be unchanged. Reopen the editor/admin preview, verify evidence and check the public URL remains 404 and absent from sitemap/search. Stop the pilot at this draft review; publication is a later manual user decision after images and all blockers are resolved.
10. On a failed/ambiguous save, inspect the list before retrying. Never fall back to a MongoDB insert or bypass indexes/validation. On a regression, disable imports and follow the application-first rollback plan, retaining the security patches rather than reverting to the known-vulnerable pre-review dependency tree. Keep draft/hub records and indexes unless their removal is separately approved after checking for later edits/reuse.

No first real save, production setting change, index migration, commit, push, deployment or publication is authorized by this report alone.
