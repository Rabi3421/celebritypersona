# Production index plan — proposal only, not executed

The read-only inspection on 14 November 2026 found 16 outfits, 14 celebrities, 16 occasions, 19 brands and 0 SEO reviews. All are ordinary, uncapped, non-timeseries collections. Atlas reports MongoDB 8.0.37, a replica set, sessions and wire version 25. This supports the driver's `withTransaction` mechanism with primary reads, snapshot read concern and majority write concern. No production transaction or write probe was attempted. See [MongoDB's transaction documentation](https://www.mongodb.com/docs/manual/core/transactions/) and the captured [database evidence](database-audit-after.json).

## Essential guarantees

| Collection | Index key | Requirement | Observed production state |
| --- | --- | --- | --- |
| outfits | `{id: 1}` | Unique, all imported IDs covered | Existing `id_1`, reuse |
| outfits | `{slug: 1}` | Unique; partial on string slugs or stronger full index | Missing |
| outfits | `{"researchImport.instagramUrl": 1}` | Unique; partial on string source identities | Missing |
| celebrities | `{id: 1}` | Unique | Existing `id_1`, reuse |
| celebrities | `{name: 1}` | Unique, collation `{locale:"en", strength:2}`, caseLevel false | Missing |
| occasions | `{id: 1}` | Unique | Existing `id_1`, reuse |
| occasions | `{name: 1}` | Unique, same case-insensitive collation | Missing |
| brands | `{id: 1}` | Unique | Missing |
| brands | `{name: 1}` | Unique, same case-insensitive collation | Missing |

MongoDB's native `_id_` index is already intrinsically unique; the deterministic imported `_id` uses it without another index. `seoReviews.key_unique` already exists and remains sufficient for the separate research store. The imported save checks index semantics, not a mandatory name, so it accepts compatible existing indexes without rebuilding or renaming them.

**Exactly six additive indexes are needed for the implemented save path.** The corrected ordinary/import backend also requires one separately approved `catalogWriteState` coordination document, described below. Existing content documents need no automatic backfill. No ID, slug, name, status or live outfit needs rewriting. There are no observed numeric-ID, stored/effective-slug, imported-post, trimmed/case-normalized name or English strength-2 name duplicates. All four content collections have valid positive integer IDs; all outfit slugs are stored; hub names are already trimmed. Repeat these checks immediately before an approved migration because other editors can change the data.

Optional query/performance indexes are not rollout requirements. The current small catalog is read and compared in application memory; adding a product-URL index would not accelerate that existing code. Future indexed queries on canonical product identity can be designed with the batch workflow. Do not add speculative indexes now.

## Approved-operator sequence

1. Obtain separate approval for the six index definitions, the coordination collection/document and runtime permissions, and choose a maintenance window. Keep imported writes disabled: `CP_OUTFIT_IMPORT_WRITES` must be absent or different from `enabled`. Do not change that setting as part of this review.
2. An operator with the appropriate database role selects the verified production database through their normal managed connection, outside the research/Codex session. Do not paste a URI or password into a prompt. Capture a fresh collection/index inventory and a managed backup/checkpoint of the affected data. This review's hashes are verification evidence, not a restorable backup.
3. Pause ordinary admin content writes and related maintenance jobs for the short migration window, without changing Cloudflare or Slack automations. Recheck duplicate names under the target collation, IDs, effective and stored slugs, and source identities. If anything conflicts, stop and ask for a record-specific decision. Never deduplicate, rewrite or delete automatically.
4. Confirm that no compatible index has appeared since this report. Record existing definitions. Run only the following six definitions that are still missing. Each call below is **a proposal**, not a command run during the review:

   ```javascript
   db.outfits.createIndex(
     { slug: 1 },
     { name: "outfit_slug_unique", unique: true,
       partialFilterExpression: { slug: { $type: "string" } } }
   );
   db.outfits.createIndex(
     { "researchImport.instagramUrl": 1 },
     { name: "outfit_import_post_unique", unique: true,
       partialFilterExpression: { "researchImport.instagramUrl": { $type: "string" } } }
   );
   db.brands.createIndex(
     { id: 1 }, { name: "brands_id_unique", unique: true }
   );
   db.celebrities.createIndex(
     { name: 1 },
     { name: "celebrities_name_unique", unique: true,
       collation: { locale: "en", strength: 2 } }
   );
   db.occasions.createIndex(
     { name: 1 },
     { name: "occasions_name_unique", unique: true,
       collation: { locale: "en", strength: 2 } }
   );
   db.brands.createIndex(
     { name: 1 },
     { name: "brands_name_unique", unique: true,
       collation: { locale: "en", strength: 2 } }
   );
   ```

5. After each successful creation, record the name in a migration-specific **created-index ledger**. If any call fails, leave imports disabled and stop. Do not drop a conflicting existing index to make the migration pass. Confirm final key/uniqueness/partial-filter/collation semantics and confirm document hashes/counts are unchanged during the paused-write window.
6. Keep the content-write window closed until index, coordination and compatible deployment verification are complete. Provision the coordination document as described below, and drain/retire all old application instances and maintenance processes. Both ordinary and imported outfit saves now share the tested transactional backend. Deploying it without the required indexes or coordination fails closed for ordinary catalog writes too. Do not reopen writes on the old nontransactional backend after adding the constraints.
7. Separately approve the reviewed commit/deployment and dependency risk decisions. Deploy with imports disabled, verify read-only/admin behavior, then separately approve enabling `CP_OUTFIT_IMPORT_WRITES=enabled` **only in the production environment**. The guard also requires `VERCEL_ENV=production`; preview deployments cannot opt in.

The application role needs its existing authentication/editor permissions plus `find`, `insert`, `update`, `remove` as used by the reviewed writers and `listIndexes` on the four content collections; the existing redirect collection needs its usual read/write permissions. The new coordination collection requires runtime `find` and `update`. An operator must provision it; runtime collection creation or index-management permissions are not required. A narrowly scoped current role may therefore need a separately approved grant. Index provisioning belongs to the operator's migration role, not the app or a research tool. Session/transaction operations and majority writes must be permitted on the selected replica set. No new credential or role was created during review.

## Rollback

Preferred application rollback: disable imported writes first and let in-flight requests finish, keeping the patched application running with imports disabled. If a binary rollback is necessary, pause and drain all catalog writers first, then use a separately approved build retaining the new ordinary-save transactions/coordination as well as Next/Zod security updates, JSON-LD escaping and preview write guard. The old nontransactional backend is not a compatible fallback while these constraints remain. The pre-review Next 16.3.3 build is not a security-equivalent rollback target. Retain created drafts, provenance and compatible uniqueness indexes. This requires no document mutation, preserves human edits and keeps duplicate protection. A draft remains a draft on the existing application because the status field is already supported.

If an **index rollback is separately approved**, pause content writes again and use the created-index ledger. Drop only indexes that this specific migration actually created; never drop reused `id_1`, `_id_`, `seoReviews.key_unique` or a pre-existing equivalent. The potential names are:

```javascript
// Only execute the entries present in the approved created-index ledger.
db.outfits.dropIndex("outfit_slug_unique");
db.outfits.dropIndex("outfit_import_post_unique");
db.brands.dropIndex("brands_id_unique");
db.celebrities.dropIndex("celebrities_name_unique");
db.occasions.dropIndex("occasions_name_unique");
db.brands.dropIndex("brands_name_unique");
```

Verify existing data/counts are unchanged and keep imported writes disabled. Do not delete pilot drafts or related hubs as part of software/index rollback: those may have been edited or reused. Any later record cleanup requires its own dependency check, backup and explicit approval. No such rollback commands or production mutations were run here.

## Corrective reassessment: exact six-index effects

All six are **unique**, **not sparse**. Only the two outfit indexes are partial. Only the three name indexes use case-insensitive English strength-2 collation (accents still distinguish names); the others use simple collation. The six complete createIndex definitions above are unchanged.

| Index / complete key and options reference | Business need; affected records | Missing, null, empty and legacy behavior | Normal create/edit/publication; import requirement |
| --- | --- | --- | --- |
| `outfits.outfit_slug_unique`, `{slug:1}`, unique, partial `{slug:{$type:"string"}}` | Stops two stored slugs claiming one public URL; every existing string slug participates | Missing/null/non-string excluded. Empty string is included and only one is allowed. Case-sensitive; valid forms force lowercase. Effective legacy fallback slugs require the separate application/audit check | Shared transaction rejects collision before committing hubs; unlock/redirect behavior preserved. Mandatory for ordinary saves and imports |
| `outfits.outfit_import_post_unique`, `{"researchImport.instagramUrl":1}`, unique, partial `{"researchImport.instagramUrl":{$type:"string"}}` | Prevents concurrent duplicate canonical imported post identities; affects any historical document with a string at that path | Missing/null excluded. Empty string included and unique; malformed/case/URL variants must be audited, not treated as valid canonical identities. Existing 16 ordinary outfits had no import identities in the earlier audit | Ordinary edits preserve provenance. Manual publication remains a separate decision. Required for imports; ordinary backend does not require this index |
| `brands.brands_id_unique`, `{id:1}`, unique full | Numeric IDs route editor updates; prevents a collision from editing the wrong brand. All brand documents participate | Missing and null occupy the same null key: at most one combined. Empty string is a key; duplicate empty values conflict. Index alone does not prove positive integer IDs; allocator/audit require those | Safe max+1 inside coordination transaction; collision from external writer rolls back. Required for ordinary and imported saves |
| `celebrities.celebrities_name_unique`, `{name:1}`, unique full, collation `{locale:"en",strength:2}` | One genuine celebrity identity row; all celebrity documents participate | Missing/null share one key; empty string allowed only once. Case variants collide. Whitespace is not collapsed by the index; NFC/trim/whitespace/lowercase checks additionally reject ambiguous legacy records. Name must be a nonempty string in audit/application | Genuine match reuses stored name; explicit create/edit rejects another identity. Explicit merge is transactional. Required before ordinary saves/imports |
| `occasions.occasions_name_unique`, `{name:1}`, unique full, same collation | Prevents forked occasion identities; all occasion documents participate | Same missing/null/empty/case/whitespace behavior as celebrity names | Shared ensure, explicit standalone edit/create and rename/merge are transactional. Required before ordinary saves/imports |
| `brands.brands_name_unique`, `{name:1}`, unique full, same collation | Prevents duplicated labels when multiple outfits introduce a brand; all brand documents participate | Same missing/null/empty/case/whitespace behavior as celebrity names | Shared ensure creates/reuses genuine identity with safe IDs; standalone brand editorial input cannot change name/id. Required before ordinary saves/imports |

The earlier read-only production audit found valid IDs/names/slugs and no conflicting keys under these definitions, nor conflicting effective slugs or trimmed/case-normalized names. This corrective phase made **no production connection**; those observations are historical, not certification of today's data. The exact definitions were installed and missing/null/empty/case collisions exercised against synthetic documents in the disposable replica set. Malformed legacy IDs and ambiguous whitespace-normalized names are refused without partial saves.

For **each index**, verification is: (1) under paused writers, save the current `listIndexes` definition and counts plus stable, sorted content hashes; (2) rerun the read-only audit script against the selected database, reviewing the key group for that collection, and stop on any invalid, duplicate or ambiguous values; include computed/effective outfit slugs and canonical post identities rather than relying solely on stored key groups; (3) build only if its exact approved equivalent is absent, record the actual created name in the ledger; (4) re-read its unique/key/partial/sparse/collation options and compare counts/content hashes. The audit script is read-only and uses collation-aware grouping; do not use write probes against production. Repeat the synthetic concurrency/rollback suite on the reviewed source in a disposable database. Index builds may consume resources, acquire locks and fail if nonparticipating writers remain; monitor the approved window.

For **each index**, rollback is the corresponding exact `dropIndex` call in the earlier rollback block **only if its actual name is in this migration's created-index ledger** and removal is separately approved. Pause/drain writes first, inspect active sessions/transactions and uncertain outcomes, save its definition, drop only that ledger entry, re-read indexes and verify unchanged content. Never drop reused equivalents/native indexes. The corrected app deliberately refuses subsequent saves when a required index is absent; keep writes paused until a separately reviewed compatible configuration/build is restored. Neither an index build nor its rollback should rewrite any content documents.

## Additional prerequisite: catalog coordination

With all catalog writers paused and drained, an approved operator provisions the collection and exactly one document, after first checking that neither an incompatible collection nor an existing coordination document is present:

```javascript
// Proposal only. Do not reset an existing version or run alongside writers.
db.createCollection("catalogWriteState");
db.catalogWriteState.insertOne({ _id: "catalog", version: 0 });
```

If the compatible collection/document already exists, reuse it after verifying the native `_id_` index and nonnegative safe-integer version; never reset it. It needs no seventh custom index and no outfit/hub backfill. Capture its existence/definition in the migration ledger. Verify application `find`/`update` and transactional access with the approved operator role strategy; this local review does not establish the exact scope of production credentials.

Roll out the reviewed backend **before reopening ordinary writes**, with imports still disabled. Missing readiness fails closed, so deploying before provisioning would interrupt catalog editing. Do not roll back to the old partial-write backend with the new constraints active. Keep the coordinator during application rollback unless its removal is separately approved with all writers paused/drained and a compatible replacement plan. If removal is approved and this migration created it, remove only the ledger-owned `catalog` document/empty owned collection after verifying no other data or active transaction; do not delete a reused collection. No automatic cleanup is provided.

See [atomic-save-review.md](atomic-save-review.md) for writer inventory, transaction/conflict guarantees, tested limits, sequencing and pending approvals.