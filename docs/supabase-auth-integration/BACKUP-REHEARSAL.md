> Historical pre-deployment evidence. For the completed production state and corrected pgTAP result, see [REPORT.md](REPORT.md) and [PRODUCTION-EXECUTION.md](PRODUCTION-EXECUTION.md).

# Production backup and isolated restore rehearsal

Completed 2026-11-02. **Backup and local restore verified; four migrations and all 15 real integration tests passed.** One unchanged pgTAP assertion conflicts with an existing managed production helper. Hosted signup/login were not tested.

Project: **ocihwiqtgqplwgyhpwjv**, iAnalyze Academy, Ireland, PostgreSQL 17.11. No hosted application schema, Auth configuration, Storage or Edge resources were changed. No production migrations, Cloudflare deployment, push or merge occurred.

## Backup integrity

Restricted directory outside the repository and Git:

C:\Users\khale\SupabaseBackups\ianalyze-academy\20261102T133805Z

NTFS inheritance is disabled; only the owner, SYSTEM and Administrators have access. Disk encryption and an independent/off-device copy were not verified.

| Export        |   Bytes | SHA-256                                                          |
| ------------- | ------: | ---------------------------------------------------------------- |
| roles.sql     |   6,173 | b8c8bcf985499dcea2fcbf264bbda16450669293be3925be9c2b296cceda1ac0 |
| database.dump | 367,824 | e53a06147024a0a86178e09901961efe68b3cabc95d24fec4cff3867cfb78579 |
| schema.sql    | 304,902 | cdf49268c3c69f5e0acd420424b6736884fd99df8433ebecf4fb4c57d74164a9 |

The custom archive contains schema/data, including managed Auth/Storage schemas, with 563 catalog entries. The directory also contains manifest.json, SHA256SUMS.txt, catalog snapshots, supplemental restore SQL, RESTORE-LOCAL.ps1 and test results.

The password was read in memory from the owner's secret file. The IPv6-only direct endpoint was unreachable. The authenticated CLI resolved the exact session pooler with the supplied password in its child environment; its generated script was captured only in memory, never printed or saved. No temporary login-role or network-unban path was used. Authentication succeeded with Supabase's official CA, full TLS hostname verification and read-only SQL: database/role postgres, read-only on, version 17.11.

PostgreSQL 17.11 exported through read-only sessions. A transient password file was copied into disposable container memory with mode 0600; its host copy was removed afterward. Passwords were absent from command arguments and output. The roles export excludes passwords. An exact-value scan found no supplied production password in 419 tracked/report files or the core backups; no matching contents were printed.

Scope: PostgreSQL logical backup, not a full Supabase project image. Hosted Auth/SMTP configuration, role passwords, external encryption root keys and Storage file bytes are excluded. The snapshot had zero Auth users, Storage objects and Vault secrets, so no Storage byte download or encryption-root transfer was required. Account password hashes would be included in database data when users exist; none existed here.

## Restore proof

Dedicated container: **academy-restore-rehearsal-20261102**, image public.ecr.aws/supabase/postgres:17.11.0.006. It started networkless. API testing used an independent internal network, service containers/volumes and container-local proxies, with no published ports. The original local stack was preserved.

The baseline was restored successfully twice, including a fresh replay with RESTORE-LOCAL.ps1. The wrapper validates the exact container name, rehearsal label, internal network, absence of published ports, PostgreSQL 17, project identity, file hashes and a fresh database name. It refuses to reset/delete existing databases and accepts no hosted connection string.

Local restore steps:

1. Restore password-free roles, skipping CREATE only for roles already present; retain original attributes and memberships.
2. Create an empty database from template0.
3. Temporarily disable the isolated image's extension-owner promotion hook. Inside the restore transaction, temporarily elevate only its local postgres role to reproduce original extension ownership; return it to NOSUPERUSER before completion.
4. Create extensions and ensure_rls under original owners. Replay 12 catalog-exported grants for the two managed GraphQL schemas, omitted by raw pg_dump's initial-privilege handling.
5. Restore all objects/data in one transaction with ON_ERROR_STOP. Reset/reload the local compatibility setting in a finally block and verify the original non-superuser role.
6. Compare all catalog categories and all table row counts before migrations.

Initial attempts exposed event-trigger ownership and extension/schema privilege differences. Failed restore transactions rolled back. Attempts with comparison differences were not counted as verified. The final reusable-script replay passed every comparison.

| Comparison category                                  |                                  Count | Result |
| ---------------------------------------------------- | -------------------------------------: | ------ |
| Schemas, owners, ACLs                                |                                      9 | Match  |
| Non-system roles/attributes                          |                                     16 | Match  |
| Role memberships, grantors/options                   |                                     25 | Match  |
| Relations, owners, ACLs, RLS flags                   |                                    186 | Match  |
| Columns/defaults/column ACLs                         |                                    631 | Match  |
| Policies before application migrations               |                                      0 | Match  |
| Non-internal row triggers                            |                                      9 | Match  |
| Managed event triggers                               |                                      7 | Match  |
| Functions, owners, ACLs, settings, definition hashes |                                    105 | Match  |
| Default privilege records                            |                                     24 | Match  |
| Extensions, versions, schemas, owners                |                                      5 | Match  |
| Expanded schema grants                               |                                     58 | Match  |
| Row counts                                           | All 39 tables; 248 managed/system rows | Match  |

ACL entry order was normalized; privileges, grantors and grant options were retained. Both catalog queries used the pg_catalog search path. The cli_login_postgres role was already in the production export; this task did not create it remotely.

Inside the dedicated container, academy_restore is the pristine baseline, academy_rehearsal_proof is the independent script replay, and postgres is the migrated/tested clone. Repeat the wrapper with a new name such as academy_rehearsal_second. The inspected script was tested in child PowerShell with a process-only execution-policy override; persistent Windows policy was unchanged.

**Hosted recovery limitation:** this local procedure uses supabase_admin and local provisioning controls. It does not demonstrate a hosted in-place restore as restricted postgres. Hosted recovery needs a separately reviewed managed-Supabase procedure, possibly provider assistance, and explicit approval. Never run the local compatibility SQL against production or automatically reset/restore after a migration failure.

## Migration rehearsal

All four files were checksum-verified and applied unchanged, in order, to a baseline clone as the original **non-superuser postgres** role. Each file used its own BEGIN/COMMIT with psql ON_ERROR_STOP. This rehearsed SQL execution, not hosted CLI migration-history initialization.

| Migration                                   | Effects                                                                                                            | SHA-256                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 20261101000100_academy.sql                  | Profiles; private roles/audit; activities/rubrics; Auth bootstrap/sync; RLS/grants and role/registration RPCs      | cce65ab93ed9df00b670fcee7c8f63608b9fcabbfd0b871b5839cb891536a36e |
| 20261101000200_assessment_storage.sql       | Submissions, grading/validation, private buckets and Storage policies                                              | af1f2d2a2aff5829299d76634c43790e7c010d51e382bcb0a64157ede9059468 |
| 20261102000100_functional_delivery.sql      | Notebook metadata, quotas, trusted finalization, rubric editing, resubmission, pseudonymous rankings; gates closed | cecd59f1a3e9ae79aab67937a9d5c2d0c123abb9a31d7c954cd6f833af40fbb8 |
| 20261102000200_assessment_review_status.sql | Hardened grading-status trigger and reconciliation of matching submissions                                         | f5af6e565227f0d58dfb179536a84a9c008b9e365612887d5e08ea914b272109 |

Permissions and Storage resources change; migration 4 can update matching submissions. The four files are not one atomic transaction. On failure, inspect the committed prefix/history before reviewing a forward correction or approved recovery. Do not blindly rerun files, repair history or reset production.

## Tests and authorization

| Check on the restored/migrated environment                  | Outcome                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| Existing real Auth/REST/Storage/Edge/mail suites, unchanged | 15 passed; 0 failed/cancelled/skipped                                   |
| Existing boundaries.test.sql, unchanged                     | 11 passed; 1 failed                                                     |
| Additional restored-baseline pgTAP checks                   | 12 passed; 0 failed                                                     |
| Existing live TypeScript database contract checker          | Passed                                                                  |
| Application schema                                          | 10 tables with RLS; 17 policies; 11 invoker public RPCs                 |
| Final gates                                                 | Legacy uploads, trusted submissions, leaderboard all false              |
| Final fixture counts                                        | Auth users, profiles, weeks, submissions, grades, Storage objects all 0 |

Real local cases exercised captured-email signup/confirmation, PKCE login/recovery, logout, Student defaults despite forged metadata, cross-user privacy, Team grading/revocation, private Storage/MIME/size restrictions, trusted uploads, ownership/idempotency/resubmission, deadlines/quotas, grade statuses and deterministic pseudonymous rankings. Leader and Organizer use the existing shared team authorization level. These were real local services against the restored database, not embedded/mock or hosted tests.

The original pgTAP failure is **No exposed security-definer functions**. Production already contains public.rls_auto_enable(), returning event_trigger. It was preserved. Additional checks verify the exact 11 invoker application RPCs, no other public definers, the helper's original owner/search path/signature/body hash and all seven managed event triggers. They also verify status-trigger permissions, direct grading/finalization restrictions, RLS, private buckets, closed gates and cleanup. The original assertion was not removed or relaxed. A reviewed test update is needed before calling the entire unchanged database suite green.

Initial isolated API startup failed because role passwords are excluded from exports; configuring local test logins resolved it. An initial integration attempt had 9 passes/6 Edge failures because the copied runtime lacked its original working directory. Correcting only that container setting yielded the final 15/15 pass. Application code and assertions were unchanged.

## Deployment readiness

Final production read-only verification at **2026-11-02 14:10:33 UTC**: application tables 0; Auth users 0; Storage buckets/objects 0; migration history absent; managed event triggers 7. Password authentication was independently rechecked in read-only mode. Hosted Auth settings were not changed or newly re-audited.

Local backup/restore and migration prerequisites are demonstrated. Production remains **on hold** pending:

- Review of the original pgTAP baseline assertion without allowing arbitrary public definers.
- Explicit approval of the four migrations, private buckets/policies, signup-race handling and migration-history initialization.
- Canonical hostname confirmation and separate approval of proposed Auth Site URL/redirect/password settings. Hosted email delivery, signup/login/recovery and test users remain unverified and require approval.
- Review of hosted recovery accounting for managed-role privileges; local restore success is the recovery evidence available now.
- Separate approval for Edge/Cloudflare deployment and feature activation. Keep frontend/database launch flags closed.

The six isolated API services were stopped after testing; the dedicated database/volumes and backups were preserved. The original local stack was left running. Branch: codex/supabase-auth-integration. HEAD: 705992af5f65f6cc51dd79048deb6f01c3b8d336. This report is new uncommitted documentation; application files and reviewed migrations are unchanged.
