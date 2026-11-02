# Production readiness report — 2026-11-02

**Database and Auth: complete and read back. Release: prepared locally, awaiting the owner's push.** Existing project `ocihwiqtgqplwgyhpwjv` / `ianalyze-academy`, organization iAnalyze Academy, eu-west-1, PostgreSQL 17.11. No new project, hosted test users, push, merge, manual Edge deployment or Cloudflare deployment was performed. The frontend design is preserved.

## Database and security

All four immutable reviewed migrations are recorded in production, in this order:

| Migration                                     | Effect                                                                                                                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261101000100_academy.sql`                  | Private roles/audit, profiles, weeks, activities, rubrics/criteria, Auth bootstrap/email synchronization, grants, RLS and role/registration RPCs.                                      |
| `20261101000200_assessment_storage.sql`       | Submissions, grades/criterion scores, authorized grading, the two private buckets and object policies.                                                                                 |
| `20261102000100_functional_delivery.sql`      | Trusted notebook reservations/finalization, digest/size validation, request budgets, rubric editing, review/resubmission operations, private Team directory and gated public rankings. |
| `20261102000200_assessment_review_status.sql` | Atomic grading-derived submission status, private hardened trigger, preservation of explicit resubmission requests and reconciliation of prior reviewed submissions.                   |

The original migration bytes still match the reviewed hashes in [FINAL-READINESS-REVIEW.md](FINAL-READINESS-REVIEW.md). Migration history was initialized only for these four applied migrations. No table drops, database reset, hosted user deletion or destructive rollback occurred. Existing functions, triggers, extensions, grants and managed metadata matched the restored checkpoint comparisons; the separately approved exception concerned only the existing CLI login role's expiry timestamp.

Production has **10 application tables with RLS**: eight in `public` (`profiles`, `academy_weeks`, `activities`, `rubrics`, `rubric_criteria`, `submissions`, `grades`, `grade_criterion_scores`) and two private (`app_private.user_roles`, `app_private.audit_events`). There are **17 policies and 11 public security-invoker RPCs**. Auth bootstrap assigns Student server-side and ignores privileged role metadata. Leaders and Organizers share `team` authorization. Profile email/system fields, role assignment, audit writes and direct grade changes are protected. Public rankings use stable pseudonyms and expose no phone/email/contact data.

The trusted reservation/finalization/request-budget functions are service-only; authenticated clients cannot call them. The private grading-status trigger has a fixed search path and no anon/authenticated EXECUTE grant. Anonymous profile reads, private role writes and direct grade updates are denied. Local tests verify cross-student isolation, Team revocation on an existing session, score/rubric bounds, atomic rollback and ranking ties/best-attempt aggregation.

| Bucket                | Public | Size limit      | MIME allowlist                                 |
| --------------------- | ------ | --------------- | ---------------------------------------------- |
| `student-submissions` | false  | 262,144 bytes   | `application/x-ipynb+json`, `application/json` |
| `team-materials`      | false  | 1,048,576 bytes | `text/markdown`, `application/pdf`             |

Storage object RLS and ownership/Team policies are present. All three database gates remain false: `uploads_enabled`, `submission_service_enabled`, `leaderboard_enabled`. Final read-only verification found zero hosted Auth users and zero Storage objects. Empty dashboards/materials represent the current empty database.

## Auth and frontend

Signup was paused during migration and restored to its prior enabled setting after every database checkpoint passed. Read-back verified:

- Site URL: `https://ianalyze-academy.pages.dev`
- Exact redirects: `https://ianalyze-academy.pages.dev/auth/callback` and `https://ianalyze-academy.pages.dev/auth/callback?flow=recovery`
- Minimum password length 12; secure password change enabled.
- Email confirmation remains required. Existing SMTP metadata/configuration and all seven mapped rate limits were preserved by fingerprint comparison. Their values and credentials are not documented.

Real local registration, confirmation-required responses, captured-email PKCE callbacks, recovery, login/logout, session refresh/persistence, cross-tab logout and protected Student/Team routes pass. Recovery requests now inspect the SDK's returned error; failed requests show the existing Arabic/English error rather than a misleading success. The browser regression deliberately blocks the local recovery endpoint and verifies that error state.

**No hosted registration, login or external email delivery has been exercised.** The owner prohibited hosted fixtures. The production build intentionally keeps registration, submissions, leaderboard, privacy approval and dev previews false. Login/recovery navigation and signed-out route protection work in the configured candidate; those checks do not claim hosted user authentication.

## Push-triggered release

[The workflow](../../.github/workflows/production.yml) uses verified immutable official checkout/setup-node commits, Node 24, locked dependencies, full Git preservation history, read-only repository permissions and serialized production runs. It triggers only on pushes to `codex/supabase-auth-integration` and `main` in `khaled-amireh/ianalyze-academy`. The feature-branch push publishes the actual pushed SHA to Cloudflare's production label `main`; it does not change Git's main branch.

Existing Cloudflare target verified read-only: account `f25401b10b1826c747cd11739a9410bc`, Pages project `ianalyze-academy`, production branch label `main`, canonical origin `https://ianalyze-academy.pages.dev`, Direct Upload. No project is automatically created. GitHub Actions is enabled; the two encrypted secrets and seven required repository variables were configured and read back by name/value as appropriate. See [README.md](README.md) for the exact names and push commands. Secrets are isolated to deployment steps, never Vite inputs.

CI first validates source/security/preservation, then builds both closed public and configured production artifacts. It verifies the Cloudflare target before any deployment. It then releases `notebook-submit` using the pinned Supabase CLI with server-side Auth verification, exact allowed origin and uploads false, and requires a 401 for an invalid identity. Only then does it upload Pages, verify the canonical index digest and callback no-store headers. CI never applies database migrations or creates test users. Release scripts reject manual/local, PR, fork and unreviewed-branch deployment attempts.

The Edge function and Pages release remain pending the owner's push. The Cloudflare secret's value/scope cannot be read back from GitHub; a real target read succeeded with the existing owner OAuth credential, while the Actions token will be checked during its first run. Insufficient token scope, expired credentials or platform failures stop the workflow and prevent a green release. No known missing credential/configuration remains.

## Verification results

| Check                                   | Actual result                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Fresh locked install                    | Passed Windows; passed fresh Linux Node 24                                                                                                 |
| TypeScript, ESLint, formatting          | Passed; complete `validate` chain passed on Linux                                                                                          |
| Unit tests                              | 28 passed, 0 failed/skipped                                                                                                                |
| Embedded PostgreSQL security            | 21 passed, 0 failed/skipped; simulated Auth/Storage fixture only                                                                           |
| Real local Supabase integration         | 15 passed, 0 failed/skipped; real Auth/REST/Storage/Edge                                                                                   |
| Local pgTAP                             | 15 passed                                                                                                                                  |
| Restored production-baseline pgTAP      | 15 passed; both negative controls rejected as expected                                                                                     |
| Generated database types                | Match embedded migration catalog and real local Supabase catalog                                                                           |
| Local browser acceptance                | Passed real signup/confirmation/recovery, session, roles, uploads/grading/privacy; 20 public/Auth and 32 authenticated layout combinations |
| Configured production candidate browser | 56 navigation/layout/protection cases passed; both languages/themes, mobile/desktop, 0 app exceptions, no hosted user writes               |
| Public and configured artifacts         | Passed; configured build/artifact scan passed on Windows and fresh Linux; 46 files, no server secrets/local environment/dev previews       |
| Workflow syntax                         | Official checksum-verified actionlint 1.7.12 passed; official action commits verified                                                      |
| Preservation                            | 404 inherited files guarded; every authorized source/dependency delta individually hash-pinned                                             |
| Runtime dependency audit                | 0 advisories; 3 low dev-only findings remain in the inherited shadcn/deepmerge scaffolding dependency chain; no unreviewed force upgrade   |
| Hosted final read-only check            | Four history entries, 10/10 RLS tables, two private buckets, closed gates, approved Auth settings, intact backup                           |
| Actual Actions/hosted user flows        | Not run: owner push/live test pending; no hosted user fixtures                                                                             |

The initial Linux harness omitted the public build variables: `validate` passed, and the configured build correctly refused absent inputs. A separate fresh Linux rehearsal with the exact configured browser-safe variables passed the configured build/artifact checks. This harness setup error is resolved; the workflow supplies those variables. A missing stylesheet package was restored after a clean install caught its required CSS import. No failing test was removed or weakened.

## Backup, recovery and remaining owner decisions

The sealed logical backup remains outside Git at `C:\Users\khale\SupabaseBackups\ianalyze-academy\20261102T133805Z`, restricted to owner/SYSTEM/Administrators. All **33 checksums** and the sealed manifest hash were reverified. The archive had 563 readable entries and was restored twice into isolated PostgreSQL 17 with role/grant/RLS/trigger/count comparisons before rehearsal. See [BACKUP-REHEARSAL.md](BACKUP-REHEARSAL.md). This verifies isolated logical recovery, not hosted in-place restore or automatic Free-plan backups. Storage bytes, SMTP secrets, platform encryption roots and Auth dashboard settings require separate protection; the snapshot contained no users/objects/Vault secrets. Disk encryption/off-device redundancy were not verified.

If release fails, stop on the failed checkpoint; inspect redacted Actions/platform status. Do not reset production, reinitialize history, replay migration files or drop buckets. The database is already verified independently of this release. Frontend recovery can use an owner-reviewed prior build/forward source correction; Edge recovery uses a reviewed prior handler. Any database restore requires separate approval, a fresh current-state backup, signup maintenance and an isolated restore verification to avoid deleting newly registered users. Do not treat Git rollback as a database rollback.

Push and wait for Actions to pass, then test the live site. Hosted confirmation/recovery delivery and login remain unverified until permitted live use. Public registration, privacy content/retention approval, submission/leaderboard activation, real learning content and verified Team UUID assignments are deliberately separate launch decisions. Do not open gates or auto-promote the first registrant merely to complete a smoke test. Existing non-blocking build warning: the main JS chunk remains approximately 565 kB.
