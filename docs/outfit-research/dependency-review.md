# Dependency security review — 14 November 2026

Initial `npm audit` reported **18 vulnerable package entries: 1 critical, 10 high, 7 moderate**. These are npm's package-tree counts, not 18 independent CVEs; inherited Firebase/TypeScript-ESLint entries refer to shared underlying issues. Every affected node/version was already present in the pre-feature `HEAD:package-lock.json`. Playwright introduced **none** of these findings. Machine-readable evidence: [before](dependency-audit-before.json), [after](dependency-audit.json).

Targeted local security updates reduced the result to **12 entries: 0 critical, 5 high, 7 moderate**. `npm audit --omit=dev` reports **5 high**, all in the Firebase/gRPC chain or Nodemailer. No `npm audit fix`, `--force`, Firebase downgrade or unrelated major upgrade was used. Changes affect only this feature worktree; no deployed dependency was changed.

## All initially affected packages

| Package | Initial version / severity | Installed exposure from this app | Local result / decision |
| --- | --- | --- | --- |
| `next` | 16.3.3 / critical | Production framework; App Router Server Actions are used | Updated to **16.4.6**; audit clear |
| `zod` | 4.5.2 / high | Production validation and browser import parsing | Updated to **4.6.6**; audit clear; additional import work/error bounds added |
| `sharp` | 0.35.4 / high | Production Next image processing | Updated to **0.35.5**; audit clear |
| `source-map-js` | 1.2.1 / high | Installed through Next/PostCSS and Tailwind; primarily build/source-map processing | Updated to **1.2.2**; audit clear |
| `re2js` | 2.8.6 / high | Production-installed Firestore dependency; Firestore is unused in this app | Updated to **2.8.7**; audit clear |
| `brace-expansion` | 1.1.18 and 5.0.9 / high | Development glob tooling | Updated within existing ranges to **1.1.21 and 5.0.12**; audit clear |
| `firebase` | 12.18.0 / high | Production SDK, but this app imports only modular app/storage APIs | Remaining inherited gRPC finding; conditional deferral below |
| `@firebase/firestore` | 4.17.1 / high | Production-installed, not imported by the website | Same inherited gRPC finding |
| `@firebase/firestore-compat` | 0.4.13 / high | Production-installed, not imported by the website | Same inherited gRPC finding |
| `@grpc/grpc-js` | 1.9.16 / high | Pinned `~1.9.0` by Firestore; website has no gRPC server/Firestore path | Remains; patched line starts at 1.13.6, outside the parent's pin |
| `nodemailer` | 9.1.1 / high | Production SMTP fallback; runtime reachability depends on deployment mail configuration | Remains; npm proposes 10.5.0, a major upgrade requiring separate mail tests |
| `minimatch` | 10.2.6 / moderate | Development TypeScript-ESLint glob processing | Remains; advisory needs 11.0.1+, outside current parent's `^10.2.2` range |
| `@typescript-eslint/eslint-plugin` | 8.68.0 / moderate | Development only | Inherited minimatch finding; defer with tooling group |
| `@typescript-eslint/parser` | 8.68.0 / moderate | Development only | Same |
| `@typescript-eslint/type-utils` | 8.68.0 / moderate | Development only | Same |
| `@typescript-eslint/typescript-estree` | 8.68.0 / moderate | Development only | Same; even registry latest 8.72.2 still declares minimatch `^10.2.2` at inspection |
| `@typescript-eslint/utils` | 8.68.0 / moderate | Development only | Same |
| `typescript-eslint` | 8.68.0 / moderate | Development only | Same |

The updated Next dependency also updates its matching platform/SWC support packages in the lockfile. Existing React, Firebase, Nodemailer, PostHog and ESLint configuration versions were not upgraded. Production build, TypeScript, lint and the full automated/browser workflow were rerun against the resulting tree.

## Why these updates were necessary

The [Next.js Server Actions DoS advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r) applies to App Router applications with Server Actions and lists upgrading as the remedy. This app uses that path, so deferring the framework update would not be justified merely because import requires admin authentication. The [image-optimization RCE advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) also identifies the patched sharp dependency. An absence of local Windows exploitation does not establish safety for Linux hosting.

The [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) concerns resource consumption when validating oversized collections. The import already limits bytes; it now additionally bounds depth/node/array work and diagnostic output **before** validation. Upgrading is still appropriate for the shared dependency used beyond this import.

## Deferral and follow-up decisions

**Firebase/gRPC: conditionally defer for the storage-only application.** Source inspection finds only `firebase/app` and `firebase/storage` imports, and the generated production route `.nft.json` traces do not contain Firestore or gRPC packages. That is evidence of low reachability in this build, not a declaration that the installed packages are fixed. Recheck traces after merging other branches. Do not adopt npm's suggested Firebase 9.14.0 downgrade; it is a breaking downgrade, not an acceptable automatic fix. A supported Firebase release that updates the pin, or a tested targeted override, needs its own compatibility review before any Firestore/gRPC use is added. [Underlying gRPC advisory](https://github.com/advisories/GHSA-m9gg-hp2v-232j).

**TypeScript-ESLint/minimatch: defer for controlled development/build inputs.** These packages are dev-only and do not form part of the deployed request handler. Do not treat them as safe for arbitrary attacker-supplied repositories or glob patterns. A forced minimatch 11 override changes the parent major-version contract; updating all lint tooling blindly is not warranted. Track the upstream-compatible fix and review it as a tooling change. [Underlying minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).

**Nodemailer: no unconditional waiver.** The code chooses the Brevo HTTP API when configured and SMTP otherwise. Actual production mail configuration was not inspected or changed, so API-only operation is not established by this review. Before rollout, either approve/test the 10.5.0 major upgrade separately, or have the operator verify API-only use, assess remaining parser/header vectors and explicitly accept the residual risk. SMTP-specific vulnerabilities may be lower reachability under API-only use, but they remain installed. Do not exercise real mail or change automation during this review. [SMTP mechanism parsing advisory](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-4ffr-jq9g-5ffx).

Commit/deployment approval must include these residual dependency decisions. A passing test suite is not proof that the remaining advisories are harmless.

## Local corrective pass

Re-ran the installed full and production registry audits during the atomic-save correction. Counts remain 12 total (0 critical, 5 high, 7 moderate), with five high production findings. No package or lockfile edits were introduced by this corrective pass. Existing deferrals and Nodemailer prerequisite remain. See the refreshed dependency-audit.json and atomic-save-review.md.
