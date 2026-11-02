Database/Auth integration audit and implementation, November 2, 2026, Asia/Amman. Branch: `codex/supabase-auth-integration`, created from fetched main after PR #4 (`5baffef`). Existing work was clean before the branch was created. The original three migrations, public pages, navigation, brand assets, public translations and theme CSS remain byte-identical to that main revision.

**Outcome.** Real registration, email confirmation, login, logout, session persistence/refresh, password recovery, profile completion, protected routes, submissions, Team grading and leaderboard privacy were successfully tested against the existing Docker-backed LOCAL Supabase stack. These are real GoTrue/PostgREST/Storage/Edge workflows, not embedded/mock evidence. No hosted user was created or changed. Hosted registration/login, external SMTP delivery and a configured production frontend remain unverified and approval-gated.

**Implementation changes.** The database regression test first reproduced that saving grades left a submission at `submitted`. The new corrective migration derives `under_review` and `reviewed` atomically from grading, retains published-review status during a draft correction, preserves explicit resubmission requests, and reconciles any existing reviewed rows. The trigger is private, security-definer with a fixed empty search path, and has no anon/authenticated EXECUTE grant. Students still have no direct submission-status or grade-write privilege. Invalid grading rolls back status and grade changes together.

Signup now distinguishes a real returned session from the confirmation-required/no-session response. It shows explicit Arabic/English verification instructions and sends verified Students and Team members to their respective dashboards. Failed session verification displays the existing generic error. No security protection was disabled to simplify testing.

Visual QA found the Team contact table compressing fields into single-character columns on mobile. Its existing scroll wrapper now retains readable table width and keyboard access. No public layout, navbar, palette or theme redesign was performed.

Local environment preparation now captures CLI status without printing keys, preserves existing environment files, and creates isolated ignored environments. Public production builds still discard local launch flags. Database type generation now derives RPC declarations from catalog metadata instead of hardcoded signatures, and the same generated contract matches the live local table/FK/RPC catalog. The nullable role result remains deliberately conservative. Dependency versions and the lockfile are unchanged.

**Schema and migration order.** [schema-catalog.json](schema-catalog.json) records tested local metadata only, without user rows or secrets.

| Order | Migration | Behavior and prerequisites |
| --- | --- | --- |
| 1 | `20261101000100_academy.sql` | Private roles/audit, profiles, weeks, activities, rubrics/criteria, Auth bootstrap/email sync, publication constraints, RLS/grants and registration/role RPCs. Requires Supabase Auth schema and standard roles. |
| 2 | `20261101000200_assessment_storage.sql` | Submissions, grades, criterion scores, grading RPC, private buckets and object policies. Requires migration 1 and managed Storage with objects RLS enabled. Deliberately rejects pre-existing Storage policies or academy bucket IDs instead of overwriting them. |
| 3 | `20261102000100_functional_delivery.sql` | Notebook digest/size metadata, trusted reserve/finalize/request-budget RPCs, atomic draft rubrics, resubmission requests and pseudonymous leaderboard. Service/ranking gates default false. Requires migrations 1–2. |
| 4 | `20261102000200_assessment_review_status.sql` | Corrective private trigger and limited status reconciliation. Does not open any gate or change table shapes. Requires grading/submission tables from migration 2. |

The first three files were not rewritten. The real local migration history records all four versions. Their exact pending order and SHA-256 values, together with the proposed production approval scope, are recorded in [hosted-readiness.json](hosted-readiness.json). Migrations have explicit transactions: an individual file fails atomically, but the four-file deployment is not one transaction. If a later file fails, earlier successful files/history remain and must be inspected before resuming. They are intentionally not scripts to rerun blindly; the CLI migration history prevents repeated application. No remote reset, history repair, arbitrary policy replacement or automatic rollback should be used.

No production extension installation is needed by these migrations on the tested PostgreSQL 17 setup. Supabase-managed Auth/Storage schemas and the `anon`, `authenticated`, and `service_role` roles must exist. pgTAP is a test-only extension. The hosted catalog already contains pgcrypto and other managed extensions; they were left unchanged.

**Tables and authorization.** Eight public tables are `profiles`, `academy_weeks`, `activities`, `rubrics`, `rubric_criteria`, `submissions`, `grades` and `grade_criterion_scores`. Two private tables are `app_private.user_roles` and `app_private.audit_events`. All ten have RLS. The tested local catalog has 17 policies, 11 invoker public RPCs and 24 private helper/trigger functions. Named trigger/event metadata and column grants are recorded in the catalog artifact.

Profiles have one unique Auth UUID, display name, private email/WhatsApp/university ID, locale, registration/consent timestamps and restricted editable fields. Signup creates the Student role independently of editable metadata. Registration is immediate after required verification/profile/consent steps; there is no Team approval queue. Leaders and Organizers intentionally share the existing `team` authorization level rather than introducing incompatible role strings. Both were tested for equivalent reads, management and grading. Forged Leader/Organizer metadata stayed Student; revocation took effect with an existing session.

Students can read/update only their permitted personal fields, released learning content, their submissions and their published feedback. Team access covers registered participants and private review/materials. Draft grades, role/audit tables and other students' contact information remain protected. Grading validates rubric ownership, completeness, precision, bounds and expected revision. Publication locks prevent rubric mutation. Public rankings sum the best published attempt per activity once; tied rankings were checked for deterministic repeated output. Only rank, alias, points and activity count are returned.

`student-submissions` is private, 262,144 bytes maximum, notebook/JSON MIME only. `team-materials` is private, 1,048,576 bytes maximum, Markdown/PDF only. Downloads require ownership/registration or Team authorization; Team materials require Team. No client overwrite/delete policy was added. The trusted Edge Function verifies identity via Auth and the authoritative database Student role despite gateway `verify_jwt=false`; it validates bounded actual bytes, notebook structure, filenames, digest, quotas, deadlines, owned paths, retries and finalization without executing notebook code. CORS uses an exact origin allowlist. The legacy direct-upload gate remains false.

**Read-only hosted audit.** Identity was verified through authenticated project and organization listings: `ocihwiqtgqplwgyhpwjv`, project `ianalyze-academy`, organization `iAnalyze Academy`, region `eu-west-1`, status `ACTIVE_HEALTHY`. The targeted project is the production project identified by the owner; the preview-branch listing returned no preview branches. SQL ran inside `BEGIN READ ONLY` and reported `transaction_read_only=on`. Configuration was read through `config diff` and `config pull --dry-run`; the preview explicitly reported `wrote=false`. Public Auth settings were read with an existing browser-safe key; secret keys were not revealed or stored. See [hosted-readiness.json](hosted-readiness.json).

| Hosted item | Audited value |
| --- | --- |
| PostgreSQL | 17.11 (project metadata: 17.11.0.011), matching local major version |
| Application tables/columns/grants | None returned |
| Migration-history table | Absent; no application migration history established |
| Auth users | 0 |
| Storage buckets / objects / policies | 0 / 0 / 0 |
| Deployed Edge Functions | None returned |
| Existing public function | `rls_auto_enable`, owner `postgres`, security-definer, `search_path=pg_catalog`, returns `event_trigger`; preserved |
| Existing schemas / managed event triggers | `auth`, `public`, `storage` / 7; no `app_private` or migration-history schema |
| Managed Storage objects RLS | Enabled |
| Email signup/provider | Enabled |
| Email confirmation | Required (`emailAutoConfirm=false`) |
| Phone signup/provider | Disabled |
| Site URL / redirect allowlist | `http://localhost:3000` / empty |
| Minimum password / secure password change | 6 characters / false |
| Custom SMTP | Enabled; actual delivery not tested |
| Email-send / signup-signin rate settings | 30 / 30 from the CLI configuration preview; unchanged |
| Available backup entries / PITR | 0 / false; WALG is enabled but is not evidence of an available tested restore point |

The expanded [readiness-inventory.sql](../../supabase/operations/readiness-inventory.sql) was executed successfully in read-only transactions both locally and against the verified hosted project. It confirmed absent application/private/migration schemas, managed Storage RLS and seven existing managed event triggers, including `ensure_rls` calling `rls_auto_enable`. That existing function has anon/authenticated EXECUTE grants but returns `event_trigger`, not a normal application RPC result. It and its owner/search path were preserved. The local pgTAP blanket public-definer check is specific to its disposable baseline; do not remove this hosted event-trigger helper to satisfy it. Validate the eleven expected invoker application RPCs and the existing helper separately after any approved migration. Rerun preflight immediately before an approved write because this snapshot cannot exclude later changes by others.

**Tests actually executed.** Exact summary is in [validation-results.json](validation-results.json).

| Check | Outcome |
| --- | --- |
| TypeScript, ESLint, formatting | Passed |
| Frontend/unit tests | 25 passed; 0 skipped/failed |
| Embedded PostgreSQL security | 21 reported tests passed: 19 scenarios and 2 parent tests; 0 skipped/failed |
| Real local Auth/REST/Storage/Edge/mail suites | 15 passed; 0 skipped/failed |
| Real local pgTAP | 12 assertions passed |
| Embedded generated types | Tables, relationships and RPCs match migration catalog |
| Live local generated types | Same contract matches actual local PostgreSQL catalog |
| Official CLI-generated types | Strict TypeScript comparison passed for all eight table Row/Insert/Update shapes, relationships and eleven RPC argument/result contracts; no-argument record aliases normalized, nullable role result deliberately retained |
| Authenticated browser journey | Real signup/confirmation, profile, invalid-password denial, session persistence/refresh, cross-tab logout, Team landing, protected routes, notebook upload, grading, own feedback, token-hash and captured-email PKCE recovery, invalid-link handling and pseudonymous rankings passed |
| Portal/browser responsiveness | 20 Auth/public route cases plus 32 authenticated Student/Team cases across Arabic/English, light/dark and 320/390/768/1440-pixel widths passed |
| Public redesign regression | 160 layout cases, 38 interactions, 2,256 contrast samples across 32 cases, no app exceptions or failed local requests |
| Theme/logo checks | All 17 passed |
| Closed production build/artifact | Passed; 46 generated files, local/private test configuration excluded, launch flags false |
| Preservation | 404 inherited files guarded; original migrations and public design unchanged; current changes individually hash-pinned |

The grading regression failed before the corrective migration and passed afterward; tests were not relaxed. A preservation-helper merge lost an inherited `added` marker during development; preserving that metadata fixed its false failure. A formatting check was corrected. Official CLI local type generation initially could not inspect Docker from the restricted agent context (`GenTypesLocalDbInspectError`, Docker API/config access denied); it subsequently succeeded in the normal owner context, and its actual generated types passed the strict comparisons above. The independently implemented live PostgreSQL catalog verification also passed. The isolated browser launch initially hit the approval-review service's usage limit; the owner launched the test-only profile and the actual browser suites then passed. No skipped suite is counted as a pass.

Final local cleanup found zero Auth users, profiles, weeks, submissions, grades and Storage objects. Legacy uploads, trusted submissions and leaderboard database gates were false. Historical test audit events/captured synthetic mail may remain inside the disposable local stack; no reviewed real work was deleted. Local services remain available for manual testing.

**Production plan requiring explicit approval.** This is a reviewable plan, not executed work.

1. Confirm the exact project again and rerun the expanded read-only inventory. Verify that `app_private` and target object names have no conflicting pre-existing definitions, Storage objects RLS is enabled, no new Auth users/data appeared, and migration history is still absent. Preserve the existing public helper and extensions. If any state changed, stop and revise the plan.
2. Arrange a private logical backup/export of the current schema/grants plus relevant Auth/data state, and verify a restoration procedure. Include Storage bytes separately when any objects exist. No hosted backup/restore was created or tested in this task. The Free plan has no automatic daily backups; the current project returns zero available backup entries and PITR is off. [Supabase backup guidance](https://supabase.com/docs/guides/platform/backups), [Free-plan backup policy](https://supabase.com/kb/faqs/platform/free-plan-backups).
3. Prefer an explicitly approved remote staging environment if hosted rehearsal is required. None was created. The existing isolated local stack is the tested environment. Free resource limits include a 500 MB database and 1 GB file storage; verify plan availability/cost before provisioning a remote branch/project. [Supabase pricing](https://supabase.com/pricing).
4. Before production migration, obtain approval for a temporary signup maintenance gate (`disable_signup=true`) to prevent new Auth accounts racing an empty-schema migration. Verify user count again. If users already exist, review a profile/role backfill before applying the original bootstrap-only migration. Do not silently delete those users.
5. Review exact file hashes/order for all four migrations. An owner can inspect the pending plan with the pinned CLI's `db push --linked --project-ref ocihwiqtgqplwgyhpwjv --dry-run --skip-vault --workdir .`. Apply the reviewed migrations only after explicit approval. Do not push the whole local config: its captured-mail/test rate limits are not a production configuration. Do not use remote reset or automatic history repair. A failure requires inspection of the committed prefix and a reviewed forward correction or tested backup restoration; no automatic destructive rollback is provided.
6. Separately approve the precise Auth changes: proposed canonical Site URL `https://ianalyze-academy.pages.dev` (owner must confirm the intended canonical hostname), exact `/auth/callback` and `/auth/callback?flow=recovery` redirect entries, minimum password length 12 and secure password change enabled. Retain email confirmation and existing SMTP. Review SMTP sender/template correctness and abuse protections; no provider password needs to enter chat/source. Keep current rate limits unless deliberately reviewed. See [redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls) and [custom SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp).
7. Complete privacy/consent-version, retention/orphan handling and Team/MFA decisions. Assign verified Leader/Organizer UUIDs to the database Team role through the owner procedure only. Obtain explicit approval before creating a hosted test account or sending real confirmation/recovery mail, then test signup, login, recovery, persistence, cross-user isolation and role revocation with the actual hosted settings. Do not run the disposable local fixture suites against production; they intentionally mutate gates and clean test records.
8. Prepare a browser-configured candidate with the real project URL and publishable key only, with registration/submissions/rankings flags still closed until corresponding verification. The deployed public artifact cannot gain a backend just by applying SQL: a configured frontend build and separately approved Cloudflare release are required. This task did not change or deploy the production website.
9. Deploy the Edge Function and create/modify remote Storage only under the corresponding explicit approval. Migrations 2–3 include bucket/policy creation, so database approval must explicitly include those two private buckets. Set exact production allowed origins and keep `ACADEMY_UPLOADS_ENABLED=false` initially. Submission activation later requires the frontend flag, Edge flag and reviewed database service gate; leaderboard activation requires frontend and database gates. Keep the legacy browser-upload gate false.

**Remaining limits.** Hosted SMTP and user flows have not been exercised, production backup/rollback is not verified, privacy/retention/Team-MFA approval remains separate, and no hosted function or frontend was deployed. Existing Team-material listing is limited to the first 100 root entries. The external Drive embed responds and shows a player, but actual playback remains unverified. The production build retains the approximately 565 kB main JavaScript chunk warning. Local success is not a claim of hosted launch readiness.

Required environment variable names and exact local registration commands are in [README.md](README.md). [approved-changes.json](approved-changes.json) lists every source change and reason. Git commit status/SHA must be verified through `git log -1` and the completion message; no push or main merge is authorized.
