# Delivery validation and remaining limits

## Executed successfully

Validation was rerun on **2026-11-01** on `codex/phase-03-supabase`, with Docker Desktop
available. `npm.cmd --prefix frontend run validate` completed successfully:

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
| Real local Auth/REST/Storage | Six scenarios passed; zero failures, cancellations or skips                                                                                 |
| Local pgTAP                  | All 12 assertions passed against the real local Supabase database                                                                           |
| Local CLI database types     | All eight public table Row/Insert/Update shapes and the three RPC call signatures are compatible with the committed frontend types          |

The embedded suite executes both migrations in actual in-memory PostgreSQL (PGlite).
Its small Auth/Storage fixtures are test code, not a second hosted project or real user
records. It verifies default Student assignment despite forged metadata, verified identity,
cross-student isolation, protected columns, draft content, immutable rubrics, atomic grading,
invalid/stale scores, private file policies, the closed upload gate and Team revocation.
Future upload eligibility is tested by a disposable-database-only function override; the
committed migrations still return false and never expose that override to a client.

The earlier production browser sweep passed **64 combinations**: eight routes × Arabic/English
× light/dark × 390/1440-pixel viewports. Checks covered route rendering, direction/language,
theme, horizontal overflow, disabled registration, both original portrait dimensions and
the exact video embed URL. No application exceptions or unexpected Supabase requests were
observed with blank backend configuration.

Fresh Chrome also requests `/favicon.ico`, which is absent from the unchanged Phase 02
frontend. The new harness records this known 404 separately and rejects other local-resource
errors. No favicon/UI change was made. The older browser scripts were preserved; the new
sweep writes only ignored artifacts instead of overwriting archived Phase 02 screenshots.

Browser details and npm audit output are in ignored `frontend/artifacts/` files, not commits.

## Real local Supabase results

The original delivery could not execute the full-stack suites because Docker was absent.
That environment blocker is now resolved; the results below replace the earlier skipped
integration suite and connection-refused pgTAP result.

Docker's Linux engine **29.9.2** started a fresh `ianalyze-academy-local` stack through the
pinned Supabase CLI **2.122.0**. Both migrations applied successfully to **PostgreSQL 17.11**.
The service images included GoTrue **v2.197.0**, PostgREST **v16.5** and Storage API
**v1.84.19**. No Supabase login or hosted project link was used.

Executed from `frontend/`:

```powershell
node --env-file=../supabase/.env.local --test tests/supabase.integration.test.mjs
```

| Scenario                        | Actual result                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Email confirmation and metadata | Unconfirmed password sign-in rejected; forged Team metadata still produced a Student role                                                  |
| REST ownership and columns      | Anonymous reads denied; Student A could not read B; registration timestamp changes denied; Team saw the three registered fixtures          |
| Grade publication               | Student grading denied; draft hidden; authorized Team revision published; only the owning Student could read the published grade           |
| Private downloads               | Owner and Team downloads succeeded; other Student, anonymous and public-URL access failed; Team materials stayed Team-only                 |
| Upload restrictions             | Student uploads/overwrites failed; privileged test uploads independently confirmed rejection of 262,145-byte notebooks and HTML MIME types |
| Team revocation                 | Changing the database role removed Team profile/file access with the existing Auth session                                                 |

**Result: 6 tests passed, 0 failed, 0 cancelled, 0 skipped.** Bucket MIME/size rejection
was tested independently of the closed Student upload gate. The suite used only synthetic
`.test` accounts and disposable notebook/PDF fixtures. Its API/database target guards ran
before networking and accepted only loopback ports 54321/54322.

Executed from the repository root:

```powershell
$env:SUPABASE_TELEMETRY_DISABLED = '1'
npm.cmd --prefix frontend run test:database:supabase
```

**Result: Files=1, Tests=12, Result: PASS.** The assertions verified RLS on all ten
application tables; anonymous profile denial; denied role updates, audit inserts, grade
updates and profile-email changes; permitted contact updates; invoker-only public
functions; the closed upload gate; both private buckets; the 256 KiB notebook cap; and
the absence of client overwrite/delete policies. The pgTAP transaction rolled back.

Post-test SQL inspection confirmed **zero Auth users, profiles, roles, learning records,
submissions, grades, criterion scores and Storage objects**. The upload gate still returned
false. Fixture-created audit events were confined to the disposable database. The local
stack was then stopped with `supabase stop --no-backup --workdir .`, removing its test
data volumes. Local credentials/logs remained ignored and were not committed.

Actual local CLI-generated types were compared using strict TypeScript checks against
all eight public table Row/Insert/Update shapes and the three public RPC signatures.
The committed role return type deliberately includes `null`, which is safer than the
CLI's inferred `string` for accounts without a verified role. No type or migration change
was necessary. These comparisons do not activate browser authentication flows.

No application, migration or test-harness defect was discovered in these runs. Only
Phase 03 validation/setup documentation was updated.

## Remaining security and launch limits

The real local stack now verifies managed-schema compatibility and the exercised Auth,
PostgREST and Storage paths. These results are scoped to the listed assertions; they
are not a hosted-project audit or a complete penetration test. Hosted integration was
not attempted or authorized.

End-to-end signup confirmation-link delivery, password recovery, multi-session/concurrent
request races, OAuth and Team MFA journeys remain outside these six scenarios. The
public authentication UI and callback handling are deferred to Phase 04. Owner approval
of privacy/consent text, production URLs, SMTP/sender configuration, abuse protection
and the Team MFA approach is still required before launch.

Uploads remain disabled. MIME/size policies do not validate notebook bytes or JSON
structure; trusted validation/finalization, quotas, retention and orphan reporting must
be implemented and reviewed before a future migration opens that gate. Reviewed work
must not be automatically deleted. See [setup.md](setup.md) for the hosted approval
and remaining owner actions.

## Dependency audit

The refreshed full npm audit reported **17 advisories: two low, fifteen moderate, zero high/critical**.
Every affected package node exists unchanged in the original lock. None of the added
Supabase, PGlite or PostgreSQL-driver packages was listed as vulnerable. No automatic audit
fix or unrelated dependency upgrade was applied. These existing development-tool advisories
need a separately scoped dependency review.
The separate `npm audit --omit=dev --json` check reported **zero production-dependency
advisories**.

## Delivery boundary

No hosted migration, hosted settings change, external SMTP enablement, real account
creation, application deployment, main-branch push or PR merge was performed.

The pending six local integration scenarios and 12 pgTAP assertions are now verified.
The foundation is ready for PR review; hosted activation and student-launch readiness
remain separate, unapproved work.
