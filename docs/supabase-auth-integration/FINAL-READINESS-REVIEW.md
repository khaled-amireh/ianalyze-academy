> Historical pre-deployment evidence. For the completed production state and corrected pgTAP result, see [REPORT.md](REPORT.md) and [PRODUCTION-EXECUTION.md](PRODUCTION-EXECUTION.md).

# Final production readiness review

Reviewed 2026-11-02. **Suitable for a controlled migration window subject to the two separate approvals below. No production write, deployment, push or merge was performed.** Hosted user flows and hosted in-place recovery remain untested.

## The pgTAP failure

The unchanged boundaries.test.sql reports 11/12 passing. Its failing assertion rejects every public SECURITY DEFINER function. The sole exception is the pre-existing managed public.rls_auto_enable(), attached to ensure_rls. This is an overly broad assertion for this reviewed production baseline, not evidence of a new application privilege-escalation vulnerability.

Fresh read-only inspection confirmed:

- Owner postgres; return type event_trigger; zero arguments; SECURITY DEFINER; fixed search_path=pg_catalog.
- SHA-256 of pg_get_functiondef: b21d88816c445d14cef5032c3cd4abaebc1db2001fcb3435022ab6b496182ca4, identical to the verified backup.
- The event trigger is enabled for CREATE TABLE, CREATE TABLE AS and SELECT INTO.
- The body obtains target objects from PostgreSQL's DDL event metadata, restricts them to public tables, quotes schema/table identifiers with format %I, and only enables RLS. It does not accept a caller-supplied object name or disable RLS.
- Both anon and authenticated lack CREATE on public. Their inherited EXECUTE grants exist and were not concealed.

Supautils skips non-superuser-owned event functions for reserved roles. Isolated read-only probes for anon/authenticated observed this no-op behavior when discarding the result. Direct result display fails with unsupported event_trigger output. Therefore the conclusion does not rely on claiming the function is impossible to invoke in all SQL expressions. [Supabase supautils](https://github.com/supabase/supautils#non-superuser-event-triggers) and [the provider's RLS event-trigger example](https://supabase.com/docs/guides/database/postgres/event-triggers) describe this managed mechanism.

The reviewed conclusion is limited to this exact unchanged helper. The 11 application RPCs remain invokers, and the 12 additional baseline-aware security assertions passed. Keep the original failure visible until a reviewed test amendment replaces the blanket assertion with the exact helper signature/owner/search-path/body-hash allowlist and continues rejecting every other unexpected public definer. No tests were weakened or modified in this review.

The helper catches and logs RLS-enablement failures. Deployment verification must therefore explicitly inspect RLS on every application table; successful DDL alone is insufficient.

## Backup and recovery evidence

Backup directory: C:\Users\khale\SupabaseBackups\ianalyze-academy\20261102T133805Z.

Fresh verification at 2026-11-02 14:20 UTC passed all **33 SHA-256 entries**, every recorded file length, archive catalog comparison and full archive decompression. The custom archive has 563 entries. Manifest SHA-256 remains **8f0d6658fe7e06ef4086c0167c952d989f99ac6cde1ad86eed834882357248b3**. The sealed backup files and manifest were not rewritten during this review.

The preserved independent script-restored PostgreSQL 17 database was rechecked read-only: all 13 comparison categories matched, including 16 roles, 25 memberships, 186 relations, 631 columns, 105 function hashes, 9 row triggers, 7 event triggers and all 39 table counts. Backup ACLs still allow only owner/SYSTEM/Administrators; inheritance remains disabled, and the temporary password file is absent. The role export has no password clauses.

**Recoverability is verified locally. Hosted in-place restoration is not verified.** The local wrapper requires guarded supabase_admin/provisioning controls and must never be run against production. Supabase's own restore guidance documents managed-owner and role-grant permission limitations. [Supabase backup/restore guidance](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

The logical backup excludes hosted Auth/SMTP configuration, role passwords, external encryption root keys and Storage file bytes. This snapshot had zero Auth users, Storage objects and Vault secrets. No current application data is missing from those exclusions. Disk encryption and an off-device copy remain unverified.

## Verified production identity and migration order

Fresh authenticated read-only verification at 2026-11-02 14:20:59 UTC:

- ID **ocihwiqtgqplwgyhpwjv**; name ianalyze-academy; organization ID gzznxrerqhzibzkodlvq, previously verified as iAnalyze Academy; region eu-west-1; ACTIVE_HEALTHY; PostgreSQL 17.11.
- Application tables/policies 0; Auth users 0; Storage buckets/objects 0; migration-history table absent; Storage objects RLS enabled; seven managed event triggers preserved.

The directory contains exactly these four migrations. All full SHA-256 hashes still match the reviewed values:

| Order | File                                        | SHA-256                                                          |
| ----: | ------------------------------------------- | ---------------------------------------------------------------- |
|     1 | 20261101000100_academy.sql                  | cce65ab93ed9df00b670fcee7c8f63608b9fcabbfd0b871b5839cb891536a36e |
|     2 | 20261101000200_assessment_storage.sql       | af1f2d2a2aff5829299d76634c43790e7c010d51e382bcb0a64157ede9059468 |
|     3 | 20261102000100_functional_delivery.sql      | cecd59f1a3e9ae79aab67937a9d5c2d0c123abb9a31d7c954cd6f833af40fbb8 |
|     4 | 20261102000200_assessment_review_status.sql | f5af6e565227f0d58dfb179536a84a9c008b9e365612887d5e08ea914b272109 |

Their effects remain: foundation/profile/role schema; assessment/private Storage; functional delivery/quotas/rankings; grading-status correction. The first three were not rewritten. Migration 4 can update matching submission statuses; the current empty database has none. These are not simply read-only or wholly additive operations: they change grants and create private Storage resources.

## Exact execution method rehearsed locally

An additional fresh clone, academy_cli_rehearsal, tested the pinned CLI **2.122.0** migration path during this review. An external scratch workdir exposed only the approved migration prefix at each step. Every dry run listed exactly one expected pending file; each subsequent push succeeded, and the ledger contained exactly 1, then 2, 3 and 4 expected versions. Final RLS-table count was 10; all database feature gates were false; Auth users/profiles were zero.

Only local test credentials were used. The temporary loopback proxy was removed afterward. No hosted migration command was executed. This closes the previous local CLI-history-initialization gap, while leaving hosted privilege differences as explicit stop conditions.

## Production execution plan and stop conditions

1. **Approval and freeze.** Require approval A for database migrations/resources and approval B for the maintenance signup gate. Persistent Auth changes also require approval B and confirmation of the canonical hostname. Freeze the exact four file hashes. Use the verified project ID explicitly, existing password in a child environment, TLS hostname/CA verification and redacted output. Do not use password arguments, temporary login roles, network-ban changes, full config push, seeds, custom roles, Vault import or history repair.
   **Stop** for missing approval, identity mismatch, a fifth migration, changed hash, credential failure or unavailable TLS verification.

2. **Maintenance and fresh baseline.** Only after Auth approval, temporarily set disable_signup=true; read it back. Drain/check in-flight signup activity and rerun the read-only inventory immediately before file 1. Require zero Auth users, no application/private-schema conflicts, no history, no buckets/objects/policies, managed Storage RLS and unchanged helper/event triggers. Revalidate backup integrity and compare current relevant catalog/data to the snapshot. Save a private sanitized snapshot of the Auth fields that will change.
   **Stop** if signup cannot be paused or any users/data/schema/policies/history appeared. Do not delete users, backfill roles, replace policies or overwrite new resources automatically. Refresh backup/rehearsal and review the revised plan if the baseline changed.

3. **One migration at a time.** Use the locally rehearsed external scratch workdir with the approved prefix only. Keep seeds disabled and use skip-vault; do not include seed/custom-role options. Run a read-only dry run showing exactly the single next filename, then apply that file. Use bounded lock/statement timeouts and stop on errors. Allow normal migration-history initialization; verify the exact recorded prefix after each file. Never apply all four without checkpoints.
   **Stop** for an unexpected pending file, unknown history version, timeout, permission/ownership error, SQL failure or committed schema without its matching history row. No automatic retry, file rewrite or migration repair.

4. **Per-file checkpoints.** After file 1 inspect foundation objects, Auth profile/role triggers and restricted grants, with user count still zero. After file 2 require all ten application tables to have RLS, correct grading privileges, two private buckets with their reviewed MIME/size restrictions, and only expected Storage policies. After file 3 verify all eleven public application RPCs are invokers and all three database gates are false. After file 4 verify the hardened private status function, revoked client execution and active grading trigger. After every step preserve the exact managed helper and seven event triggers.
   **Stop** for any missing RLS/grant boundary, public bucket, unexpected public definer, enabled feature gate, trigger change or Auth/schema drift. Do not run fixture-creating local integration/pgTAP suites against production.

5. **Final database acceptance.** Read-only verification must show four exact history versions, 10 application RLS tables, 17 policies, 11 invoker public RPCs, two private buckets, no unexpected users/objects and all feature gates closed. Compare permissions/function signatures with the validated local catalog. Keep the reviewed managed-helper exception narrow; any additional definer is a failure.
   **Stop** before Auth finalization or further release steps if any check fails.

6. **Separately approved Auth patch.** Apply only the exact fields in approval B below, then read them back. Retain email confirmation, SMTP, provider configuration and rate limits. Restore signup to its pre-maintenance enabled state only after database/Auth verification succeeds; this restores an existing setting and does not activate frontend feature flags.
   **Stop** for an unconfirmed hostname, incomplete patch, unexpected diff or incorrect redirect/password setting. Keep signup paused on failure and report the current state; do not improvise other settings.

7. **Close the window.** Report applied versions and sanitized verification evidence. Keep registration/submission/leaderboard frontend flags closed. Hosted test users/email, Edge deployment, Cloudflare deployment, feature activation, push and merge are outside approvals A/B and require separate authorization.

**Failure recovery:** the four files are not a single atomic batch. Inspect the committed prefix and actual schema/history before any recovery decision. Earlier successful files and ledger setup can remain. Prefer a reviewed forward correction when safe. Do not reset, drop schema/buckets, replay the whole backup or repair history automatically. An actual hosted restore needs owner-approved managed-role handling/provider assistance; verified local recovery must not be represented as a tested hosted rollback. Keep the maintenance gate in its reported current state until an owner-approved recovery path is chosen.

## Separate approvals requested; neither is granted yet

**A. Database migrations:** apply exactly the four ordered/hash-pinned files to ocihwiqtgqplwgyhpwjv, including migration-history initialization, the two private buckets student-submissions and team-materials, their RLS/Storage policies, and the documented verification checkpoints. Preserve all launch gates as false. Execution remains conditional on the separately authorized maintenance signup pause and unchanged baseline. No user fixtures, Edge/Cloudflare deployment, push or merge.

**B. Auth settings and maintenance gate:** confirm https://ianalyze-academy.pages.dev as the intended canonical origin, then approve only this patch:

| Field                                       | Current verified value                      | Approved proposal, if granted                                                                                       |
| ------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Signup maintenance                          | Enabled; disable_signup=false               | Temporarily pause for migration window; restore prior enabled state only after successful verification              |
| Site URL                                    | http://localhost:3000                       | https://ianalyze-academy.pages.dev                                                                                  |
| Redirect allowlist                          | Empty                                       | https://ianalyze-academy.pages.dev/auth/callback and https://ianalyze-academy.pages.dev/auth/callback?flow=recovery |
| Minimum password length                     | 6                                           | 12                                                                                                                  |
| Secure password change                      | false                                       | true                                                                                                                |
| Email confirmation                          | Required; freshly verified 14:35:18 UTC     | Keep required                                                                                                       |
| Email/phone providers, SMTP and rate limits | Email enabled, phone disabled; SMTP enabled | Preserve existing values                                                                                            |

Site URL and redirects affect confirmation/recovery links; they do not alone make the deployed frontend configured or verified. [Supabase redirect guidance](https://supabase.com/docs/guides/auth/redirect-urls). Hosted SMTP delivery and real registration/login/recovery still need a separately approved account/mail test.

Branch remains codex/supabase-auth-integration at 705992af5f65f6cc51dd79048deb6f01c3b8d336. Only review documentation and ignored local artifacts were added. No production change is authorized by this report.
