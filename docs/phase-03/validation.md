# Delivery validation and remaining limits

## Executed successfully

`npm.cmd --prefix frontend run validate` completed successfully after implementation:

| Check                        | Actual result                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                   | Passed                                                                                                                                      |
| ESLint                       | Passed                                                                                                                                      |
| Unit/frontend tests          | 17 passed: all nine existing tests plus eight new authentication/configuration/target-guard tests                                           |
| Prettier                     | Passed                                                                                                                                      |
| Production build             | Passed; Vite emitted a chunk-size warning for the approximately 697 kB JavaScript bundle (207 kB gzip)                                      |
| Production boundary          | Passed; 122 Phase 00 files unchanged, logos byte-identical, development/private material excluded                                           |
| Phase 02 integrity           | Passed; 152 preserved files and supplied portraits unchanged                                                                                |
| Dependency provenance        | Original lock copied byte-for-byte and checked against its historical hash; every old lock entry unchanged; only recorded additions allowed |
| Embedded PostgreSQL security | 14 security scenarios passed; Node reports 15 tests including the parent harness                                                            |
| Database types               | Regeneration/drift check passed against the embedded migration catalog                                                                      |
| Phase 03 preservation        | 96 prior frontend/Yomna files unchanged; permitted integration edits excluded explicitly                                                    |
| Source safety                | No tracked/new real environment files or matching high-confidence secret patterns found                                                     |

The embedded suite executes both migrations in actual in-memory PostgreSQL (PGlite).
Its small Auth/Storage fixtures are test code, not a second hosted project or real user
records. It verifies default Student assignment despite forged metadata, verified identity,
cross-student isolation, protected columns, draft content, immutable rubrics, atomic grading,
invalid/stale scores, private file policies, the closed upload gate and Team revocation.
Future upload eligibility is tested by a disposable-database-only function override; the
committed migrations still return false and never expose that override to a client.

The final production browser sweep passed **64 combinations**: eight routes × Arabic/English
× light/dark × 390/1440-pixel viewports. Checks covered route rendering, direction/language,
theme, horizontal overflow, disabled registration, both original portrait dimensions and
the exact video embed URL. No application exceptions or unexpected Supabase requests were
observed with blank backend configuration.

Fresh Chrome also requests `/favicon.ico`, which is absent from the unchanged Phase 02
frontend. The new harness records this known 404 separately and rejects other local-resource
errors. No favicon/UI change was made. The older browser scripts were preserved; the new
sweep writes only ignored artifacts instead of overwriting archived Phase 02 screenshots.

Browser details and npm audit output are in ignored `frontend/artifacts/` files, not commits.

## Implemented but NOT executed against real Supabase

| Suite                  | Status and evidence                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| Local pgTAP            | 12 assertions implemented; `supabase test db --local` could not connect to port 54322; no assertions executed |
| Real Auth/REST/Storage | Six scenarios implemented; opt-in suite reported skipped, with zero tests executed                            |
| Hosted integration     | Not attempted or authorized                                                                                   |

Docker/Podman was not detected. Local CLI status reported no linked project and no container
runtime; the database test command reported connection refused and suggested starting the
local stack. These are unavailable-environment results, not passing integration tests.

The real API suite covers email-confirmation requirements, metadata escalation, REST
ownership/protected columns, grading publication, private downloads, denied uploads and
Team revocation with an existing session. The harness verifies both API and database
targets are local before networking. Only synthetic local fixtures are created/removed.

Embedded tests do **not** verify GoTrue token issuance/signatures, PostgREST permission
translation, Storage's actual upload/MIME/size handling or managed-schema compatibility.
Those require the local full stack. Email delivery/confirmation-link and recovery journeys,
multi-session concurrency, OAuth and Team MFA flows remain later validation work.

## Dependency audit

The full npm audit reported **17 advisories: two low, fifteen moderate, zero high/critical**.
Every affected package node exists unchanged in the original lock. None of the added
Supabase, PGlite or PostgreSQL-driver packages was listed as vulnerable. No automatic audit
fix or unrelated dependency upgrade was applied. These existing development-tool advisories
need a separately scoped dependency review.
The separate `npm audit --omit=dev --json` check reported **zero production-dependency
advisories**.

## Delivery boundary

No hosted migration, hosted settings change, external SMTP enablement, real account
creation, application deployment, main-branch push or PR merge was performed.

This is a locally implemented and partially verified foundation. Full Supabase security
verification and hosted readiness are **pending**, not complete. See [setup.md](setup.md)
for the remaining owner actions and separate hosted approval boundary.
