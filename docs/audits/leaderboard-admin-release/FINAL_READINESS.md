# Leaderboard consent and Admin awards — Path B candidate

Snapshot: 2026-11-21 (Asia/Amman). Worktree: `.worktrees/academy-admin-consent-pathb-20261120`, branch `release/academy-consent-admin-main-20261120`, baseline `28d6a7d386f494f53d883998132a35b17330346f` (verified GitHub `main`). This is an isolated local candidate; nothing here has been published or applied to production.

## Product and schema scope

This candidate extends the current `main` schema only. It retains the existing activity, private notebook submission, Team grading/feedback, and public leaderboard model. It does not restore the older assignments/scoring migrations or add link/file assignments. Separate assignment types remain a future product decision.

The three forward migrations are ordered and bound to the current main schema:

1. `20261119170000_leaderboard_name_consent.sql` adds opt-in name consent and append-only consent events. The public ranking uses the current grade calculation, shows a generated pseudonym by default, and returns a saved profile name only after explicit student consent. Withdrawal removes the public name immediately. Consent columns cannot be updated directly. Registered names cannot be changed by ordinary Student/Team profile updates; the Admin correction RPC records a correction and withdraws existing consent. Consent withdrawal remains available if the leaderboard gate closes; new consent is denied while closed.
2. `20261119170100_application_admins.sql` adds a private, RLS-protected Admin registry and append-only grant/revoke events. It does not insert an Admin. The current role RPC maps an authorized Admin to the existing Team workspace role while `current_academy_is_admin()` keeps Admin-only operations separate. Name correction is Admin-authorized.
3. `20261119170200_admin_manual_point_awards.sql` adds a private append-only award ledger and Admin-only RPCs. Points must be positive integers; replay with the same Admin/idempotency key and same payload returns the original award; a conflicting payload is rejected. Manual points are added to current leaderboard totals without increasing the graded-activity count. Existing leaderboard and submission feature functions are unchanged.

The initial Admin grant remains a separate, unexecuted owner action. See [INITIAL_ADMIN_PROMOTION.md](INITIAL_ADMIN_PROMOTION.md). No Admin identity, production data, credentials, or gate value is included in these migrations.

## Validation

Completed 2026-11-21 in this worktree. Test fixtures use synthetic local accounts, profiles, grades and awards; no Supabase or production connection was used.

- `npm.cmd test` — 86/86 frontend tests passed.
- `npm.cmd run test:database:embedded` — 38/38 database/security tests passed, including the new main-schema consent and Admin award suite.
- `npm.cmd run check:types` and `npm.cmd run check:database-types` — passed.
- `npm.cmd run lint` and `npm.cmd run format:check` — passed.
- `npm.cmd run check:redesign` — passed: 404 inherited files preserved and 162 explicit hash-pinned resolutions verified; source secret scan passed. The Path B approval manifest pins 22 candidate files to this branch's `main` baseline by exact path and SHA-256; the manifest itself is not included in its own hash list.
- `npm.cmd run build:public` — passed as an unconfigured public-only build with backend and launch flags disabled; no credentials loaded.
- `npm.cmd run check:pages` — passed for the generated 63-file artifact, including SPA/CSP checks and credential-pattern scan. This is not a configured production artifact.

The release candidate has 23 changed paths: the 22 hash-pinned implementation, test, and review files plus `approved-pathb-files.json`. The three new migrations are strictly ordered by filename and apply cleanly to the embedded main-schema fixture.

## Remaining release gates

- Review the candidate diff, migration order, exact preservation approvals, and final test outputs.
- Obtain separate approval before publishing, opening a PR, merging, applying migrations, granting initial Admin access, or deploying.
- Apply migrations only in the listed order after the approved recovery and production release gates are satisfied. Keep `leaderboard_enabled`, `submission_service_enabled`, and legacy upload gates at their existing reviewed values.
- Keep the separate initial Admin grant out of migrations and require an explicitly approved, verified Auth identity and reason before executing it.

No assignments/scoring-stack behavior, production change, workflow activation, Admin promotion, or migration execution was performed.

## Worktree preservation note

The original release candidate remains on its existing branch and HEAD. The earlier `academy-admin-consent-clean-main-20261120` worktree still contains its pre-existing unmerged index entries; this candidate work did not reset, abort, continue, or otherwise modify that state. Path B was prepared separately from current `main` so its resulting diff is reviewable without carrying the older candidate patch. Current GitHub `main` was rechecked read-only at `28d6a7d386f494f53d883998132a35b17330346f` on 2026-11-21.
