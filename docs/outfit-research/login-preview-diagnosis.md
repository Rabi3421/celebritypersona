> Release validation ? 16 November 2026: the user explicitly authorized indexes, coordination documents and synthetic data in disposable local MongoDB only. All **148 automated tests passed, 0 failed/skipped; all 6 Chrome workflows passed; TypeScript and fresh production build passed; ESLint 0 errors, 1 pre-existing warning**. The harness verified its owned MongoDB PID, the sole replica-set member at 127.0.0.1:27139, replica-set name cp_outfit_test and generated cp_outfit_e2e database name before content writes. It strips inherited credentials and refuses application environment files. Disposable services were stopped and the application test database dropped (temporary folder cp-outfit-verification-Y77Lhl). Catalog/import source and dependencies are unchanged. Homepage Studio and BI worktrees are preserved; origin/main remains a8898f91d393c4b0e890fc0a916537173de164a8. Only the approved login fix/tests/documentation will be committed and pushed to the feature branch for a protected Preview. Production settings, database and imports remain unchanged. See [complete final validation](login-validation.txt).

# Preview login gate: local diagnosis and fix

Affected reported deployment: `HayY4AMqVjtjcUTFfu64LruHcywR`, feature commit `edb8e89842eea0230477884064d752ab23990c66`. The initial diagnosis was local-only. The subsequent approved protected-Preview milestone is summarized above; no production deployment or production database/configuration change is included.

## Confirmed findings and evidence limits

**Confirmed application defect:** `lib/mongodb.ts` created a MongoClient connection and required `MONGODB_URI` at module evaluation. `/admin/login` imports `readSession` through `lib/auth/session.ts`; that module imports `adminUsers`, loading MongoDB before `readSession` can return null for a missing/invalid cookie. `LoginForm` also imports login actions and credential helpers. Consequently a signed-out login render unnecessarily depended on database configuration and could fail before displaying the form.

A local production-build reproduction, with `VERCEL_ENV=preview`, synthetic signing/account configuration and **no `MONGODB_URI`**, returned:

- `/admin/outfits/new`: HTTP 307 to `/admin/login?from=%2Fadmin%2Foutfits%2Fnew`.
- That login URL: HTTP 500.
- Local runtime: `Error: MONGODB_URI is not set. Copy .env.example to .env.local.` at module evaluation in `lib/mongodb.ts`.

The unmodified import-time behavior exists in the preceding production/base commit too. The Outfit Import commit changed MongoDB only by exporting `getMongoClient`; it did not change login/session/proxy code. Catalog transactions, indexes and coordination are not required to render login or authenticate. The new remote Preview write guard only takes effect on actual writes and cannot itself explain a signed-out login GET error.

**The exact cause of the user's deployed Preview request remains unconfirmed.** Existing Vercel credentials returned HTTP **403**, error code `forbidden`, message `Not authorized`, for both account metadata and the target deployment. Runtime/function logs and environment scopes could not be inspected. No credentials were refreshed/changed and no Vercel Authentication bypass was attempted. A signed-out request to the Preview still returns HTTP 302 to `https://vercel.com/sso-api`; it does not reach the application from this session. A sanitized runtime error/digest/request time and variable-presence information were requested from the user.

Missing/invalid Preview `MONGODB_URI` is a plausible trigger, not a confirmed deployed configuration defect. Eager connection failure from networking, Atlas access/TLS or credentials is another hypothesis. A successful Preview build does not establish which runtime condition failed. No particular configuration value should be changed based solely on this reproduction.

## Production comparison

Unauthenticated GET checks against `https://www.celebritypersona.com` found `/admin/login?from=%2Fadmin%2Foutfits%2Fnew` returns **200** with the Sign in heading and no application error text. `/admin/outfits/new` returns **307** to `/admin/login`. The login response carries `noindex, nofollow, noarchive`.

The reported signed-out rendering failure is **not reproduced on current production**. This is not verification of production credential login, session revocation, environment values or all production routes. No real credentials/session were used. The old eager-import defect is present in the older code and could be triggered there if its database configuration became unavailable.

| Variable | Requirement and environment scope | Verified deployed scope/value? |
| --- | --- | --- |
| `MONGODB_URI` | Needed when checking credentials, revocations or loading catalog data. After this fix, unnecessary for a signed-out login render. If interactive Preview database access is later approved, it must target an explicitly isolated nonproduction database in **Preview**, never copy production access just for login | Preview/Production values and scope not fetched; Preview presence unknown |
| `MONGODB_DB` | Selects database; existing default is `celebritypersona`. Any approved isolated Preview configuration should specify its separate database explicitly | Not fetched |
| `ADMIN_EMAIL` | Required allowlisted account for credential/session checks in the target environment; missing value fails authentication closed | Not fetched |
| `AUTH_SECRET` | Required to sign/verify app sessions in the target environment. No-cookie login rendering does not need it; missing signing configuration cannot create a session | Not fetched |
| `VERCEL_ENV` | Vercel-provided environment classification; Preview remote-write guard and unconditional import-write refusal retained | Code paths tested using local Preview simulation; no setting changed |
| `CP_OUTFIT_IMPORT_WRITES` | Exact production-only opt-in; absent/incorrect keeps remote imports off. Preview cannot opt in | No value fetched or changed |

No variable is confirmed missing on the deployed Preview. Environment corrections, if evidence establishes one, require user approval and the appropriate **Preview** scope; production configuration must remain unchanged.

## Local fix

- `lib/mongodb.ts`: defer URI validation and connection until `getDb()`/`getMongoClient()` is actually called. Keep the existing single-client promise, development global cache, database selection and read-only wrapper. Importing session/credential helpers no longer parses/connects to MongoDB.
- `app/admin/login/actions.ts`: database/configuration/audit-write failures return `Sign-in is unavailable in this environment. Try again later.` and remain rate limited. No cookie is issued on those failures. Log only the error class name, never credentials, connection strings or driver messages. Existing email allowlist, bcrypt verification, signed cookie properties, origin enforcement, rate limits and revocation checks remain.
- Add focused module/token/rate-limit tests and Chrome login tests. The verification harness has `--auth-only`, which skips all catalog fixtures/indexes/coordination and asserts those collections were not created.

An intentionally unconfigured Preview can show its sign-in form after this fix, but cannot authenticate without its authorized database/signing setup. A Preview connected to a remote database still refuses writes, including `lastLoginAt`: credential sign-in therefore remains blocked by the existing write guard. The fix handles that failure; it does not skip the audit write or permit access. No production connection or security weakening is needed to render the form.

## Initial authentication-only validation

Command: `node --import ./tests/register.mjs scripts/verify-outfit-workflow.mjs --auth-only --mongod C:/Users/rabin/.cache/mongodb-binaries/mongod-x64-win32-7.0.14.exe`.

The harness refuses application environment files, strips inherited application secrets and owns a loopback disposable MongoDB. Its only database writes are synthetic authentication fixtures, their audit/revocation/failure-injection checks and the existing synthetic build-content fixture. It creates **no catalog collections, six proposed indexes or coordination document**.

Focused tests check missing/invalid/unreachable database import behavior, actual database access failing closed, signature/account/expiry/secret checks, rate limiting and write guards. Chrome checks the real signed-out redirect, login render, wrong password, successful synthetic login/cookie/return destination, database revocation, rejected login audit write, and missing/unreachable Preview databases with controlled failure/no session. TypeScript, ESLint and a fresh production build are run by the same command. Final run: **7 focused automated tests passed, 0 failed/skipped; 4 Chrome login workflows passed; TypeScript and fresh Next.js production build passed; ESLint 0 errors, 1 pre-existing warning** (`tests/ai-research.test.mjs:308`). See [complete validation output](login-validation.txt). The expected injected audit-write rejection logs only `Admin sign-in unavailable { name: MongoServerError }`. Temporary replica-set folder: `cp-outfit-verification-6OumTa`; disposable services were stopped and the application test database dropped. The full 143-test catalog/import suite was not rerun in this authentication-only milestone; it would provision the catalog fixtures intentionally excluded here.

## Remaining gate

Inspect the actual sanitized Preview runtime error and variable presence through authorized Vercel access before calling the deployed root cause confirmed. The user has approved committing/pushing this login fix and creating a new protected Preview after complete validation. Keep the Preview gate failed until a protected recheck succeeds. Production migration, index/coordination provisioning, write-pause/backend rollout, residual dependency decisions, import enablement and the first real two-link draft pilot remain separately gated. No production deployment is authorized. If Vercel SSO blocks non-mutating requests, application-level login verification remains unconfirmed and must be reported as such.
