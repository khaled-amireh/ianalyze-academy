# Leaderboard consent and Admin awards — Path B candidate

Snapshot: 2026-11-21 (Asia/Amman). Worktree: `.worktrees/academy-admin-consent-pathb-20261120`, branch `release/academy-consent-admin-main-20261120`, baseline `28d6a7d386f494f53d883998132a35b17330346f` (verified GitHub `main`). PR #19 was opened from commit `09032054cdb3bd4e050d46bd91f7449ed6ab3404` with the original reviewed 23-path scope. This document covers the final approved 31-path follow-up, configured validation evidence, and owner-authorized publication to that same PR. PR #19 remains unmerged; no migrations, Admin promotion, workflow activation, deployment, or production change occurred.

## Product and schema scope

This candidate extends the current `main` schema only. It retains the existing activity, private notebook submission, Team grading/feedback, and public leaderboard model. It does not restore the older assignments/scoring migrations or add link/file assignments. Separate assignment types remain a future product decision.

The three forward migrations are ordered and bound to the current main schema:

1. `20261119170000_leaderboard_name_consent.sql` adds opt-in name consent and append-only consent events. The public ranking uses the current grade calculation, shows a generated pseudonym by default, and returns a saved profile name only after explicit student consent. Withdrawal removes the public name immediately. Consent columns cannot be updated directly. Registered names cannot be changed by ordinary Student/Team profile updates; the Admin correction RPC records a correction and withdraws existing consent. Consent withdrawal remains available if the leaderboard gate closes; new consent is denied while closed.
2. `20261119170100_application_admins.sql` adds a private, RLS-protected Admin registry and append-only grant/revoke events. It does not insert an Admin. The current role RPC maps an authorized Admin to the existing Team workspace role while `current_academy_is_admin()` keeps Admin-only operations separate. Name correction is Admin-authorized.
3. `20261119170200_admin_manual_point_awards.sql` adds a private append-only award ledger and Admin-only RPCs. Points must be positive integers; replay with the same Admin/idempotency key and same payload returns the original award; a conflicting payload is rejected. Manual points are added to current leaderboard totals without increasing the graded-activity count. Existing leaderboard and submission feature functions are unchanged.

The initial Admin grant remains a separate, unexecuted owner action. See [INITIAL_ADMIN_PROMOTION.md](INITIAL_ADMIN_PROMOTION.md). No Admin identity, production data, credentials, or gate value is included in these migrations.

## Validation

Completed 2026-11-21 in this worktree. Test fixtures use synthetic local accounts, profiles, grades and awards; no Supabase or production connection was used.

- `npm.cmd test` — 92/92 frontend tests passed, including six focused production-build and Edge-filter regressions.
- `npm.cmd run test:database:embedded` — 38/38 database/security tests passed, including the new main-schema consent and Admin award suite.
- `npm.cmd run check:types` and `npm.cmd run check:database-types` — passed.
- `npm.cmd run lint` and `npm.cmd run format:check` — passed.
- `npm.cmd run check:redesign` — passed after the follow-up: 404 inherited files preserved and 164 explicit hash-pinned resolutions verified; source secret scan passed. The Path B approval manifest pins the exact candidate files to this branch's `main` baseline by path and SHA-256; the manifest itself is not included in its own hash list.
- `npm.cmd run build:public` — passed as an unconfigured public-only build with backend and launch flags disabled; no credentials loaded.
- `npm.cmd run check:pages` — passed for the generated 63-file artifact, including SPA/CSP checks and credential-pattern scan. This is not a configured production artifact.

PR #19 contains the original 23 changed paths: the 22 hash-pinned implementation, test, and review files plus `approved-pathb-files.json`. The production-build follow-up added five paths relative to the reviewed main baseline. The separately authorized v2 registration-proof adaptation adds exactly three more: `frontend/scripts/check-registration-readiness.mjs`, `frontend/scripts/registration-approval.mjs`, and `frontend/tests/registration-approval.test.ts`. The complete local candidate now contains **31 paths**, covered by 30 exact-path SHA-256 entries plus the approval manifest. The three migrations and application feature files are unchanged by these follow-ups.

## Remaining release gates

- The owner authorized publication of the complete reviewed 31-path candidate to existing PR #19 on 2026-11-21. Verify the final remote diff against the unchanged reviewed baseline; stop on unexpected paths or a changed `main`. This authorization excludes merge and all production operations.
- Obtain separate approval before merging, applying migrations, granting initial Admin access, enabling workflows, or deploying.
- Apply migrations only in the listed order after the approved recovery and production release gates are satisfied. Keep `leaderboard_enabled`, `submission_service_enabled`, and legacy upload gates at their existing reviewed values.
- Keep the separate initial Admin grant out of migrations and require an explicitly approved, verified Auth identity and reason before executing it.

No assignments/scoring-stack behavior, production change, workflow activation, Admin promotion, or migration execution was performed.

## Production build and Edge filter follow-up (2026-11-21)

The authorized local correction reads notebook-submission and leaderboard approvals only when their process values are exactly `true`; missing or malformed values leave the respective frontend feature closed. Registration still requires `ACADEMY_REGISTRATION_APPROVED=true` and the existing fresh verified-Leader proof. Privacy approval remains tied to verified registration, and development previews remain disabled. The configured artifact checker now compares all five recorded gates to those expected values.

The production workflow maps both feature-approval repository variables into the build process. Its Edge Function change filter continues watching `supabase/functions`, `frontend/scripts/deploy-supabase-edge.mjs`, and `frontend/scripts/release-target.mjs`; package manifests no longer trigger an Edge deployment by themselves.

This follow-up changes the release candidate scope. The initial local results below predate the owner-run configured validation recorded at the end of this document. Read-only GitHub metadata reports all three approval variables as `true`. The private process-only handoff took place in the owner's PowerShell session. No workflow was enabled or run.

### Follow-up validation results

- `node --test tests/production-build-release-gates.test.ts` — **6/6 PASS**.
- `npm.cmd test` — **92/92 PASS**.
- `npm.cmd run test:database:embedded` — **38/38 PASS**.
- `npm.cmd run check:types`, `npm.cmd run lint`, and `npm.cmd run format:check` — **PASS**.
- `npm.cmd run check:database-types` — **PASS**; generated RPC and relation types match the embedded migration catalog.
- `npm.cmd run build:public` plus `npm.cmd run check:pages` — **PASS** for the 63-file unconfigured public artifact; no production URL or key was embedded.
- `npm.cmd run check:redesign` — **PASS** with 404 inherited files and 164 explicit hash-pinned resolutions; source secret scan passed.
- The configured build entry point was **blocked before compilation or artifact writes** by missing process-only Supabase URL/publishable-key configuration. The full `release:check` and `check:pages:production` were not run. No fresh registration proof was available in this worktree session. Synthetic tests verify the three approval mappings and fail-closed behavior, but do not substitute for the configured artifact.

## Worktree preservation note

The original release candidate remains on its existing branch and HEAD. The earlier `academy-admin-consent-clean-main-20261120` worktree still contains its pre-existing unmerged index entries; this candidate work did not reset, abort, continue, or otherwise modify that state. Path B was prepared separately from current `main` so its resulting diff is reviewable without carrying the older candidate patch. Current GitHub `main` was rechecked read-only at `28d6a7d386f494f53d883998132a35b17330346f` on 2026-11-21.

## V2 registration proof correction (2026-11-21)

The inherited registration checker still expected all three production gates to be false; that expectation conflicted with the already-approved active submission and leaderboard services. The owner's explicit scope extension authorizes the three registration paths above and their documentation/hash updates. The reviewed original candidate's v2 proof has been adapted to Path B's `resolveProductionBuildGates` helper, so proof validation and production compilation derive the expected feature states from the same exact-string approvals. Missing or malformed approvals cannot enable a frontend feature.

The SELECT-only metadata query requires exactly three zero-argument, immutable, SQL, security-invoker boolean gate functions, owned by `postgres`, with a fixed empty search path and constant `select true`/`select false` definitions. It inspects definitions without invoking privileged gates. The exact expected values are submissions and leaderboard as approved, and legacy uploads always false. Trusted Leader verification still requires the approved UUID to have a confirmed, non-deleted, non-banned Auth account and the existing Team role. Proof validation requires schema version 2, the exact project, verified Leader, safe definitions, exact gate keys and booleans, and the existing 15-minute validity/30-second future tolerance. Legacy/expired proofs are rejected.

The HTTP request remains bound to the fixed Supabase Management endpoint and `read_only: true`. Redirects are rejected. Network and JSON failures report fixed diagnostic messages, without raw provider bodies, credential values, UUIDs, or exception details. Proof output is written only after all checks pass.

### Focused validation of this correction

- `node --wasm-num-compilation-tasks=1 --liftoff-only --test --test-isolation=none --test-concurrency=1 tests/registration-approval.test.ts tests/production-build-release-gates.test.ts tests/release-target.test.ts` — **18/18 PASS**, no skips. Includes synthetic local PostgreSQL definition/Leader tests, every approval combination, exact time boundaries, invalid/legacy proofs, SELECT-only transport, denied redirects, sanitized errors, and no proof write on failure. HTTP and proof writes are intercepted in memory; no real proof is fabricated by tests.
- The first default-compiler run exhausted local memory. The passing command above limits test concurrency and uses V8's baseline WebAssembly compiler; all assertions and fixtures still run. No operating-system, Docker, dependency, or application configuration was changed to obtain the pass.
- The prior **92/92** frontend and **38/38** database/security results remain evidence for the preceding follow-up. They are not a new full-suite result for these changed registration files. The focused result above covers the current correction; configured `release:check` will run the complete suite in the owner's prepared session.
- `npm.cmd run check:types`, `npm.cmd run lint`, and `npm.cmd run format:check` — **PASS**.
- `node --wasm-num-compilation-tasks=1 --liftoff-only scripts/generate-database-types.mjs --check` — **PASS** against the embedded catalog.
- `npm.cmd run check:redesign` — **PASS**: 404 inherited files, 164 hash-pinned integration resolutions, 94 pinned package additions, backend/Auth boundaries intact, and source secret scan clean. Independent scope verification found exactly **31 paths** and verified all **30** content hashes and applicable baseline hashes; `git diff --check` passed. No file was staged.
- The PowerShell block below parsed successfully and passed **4/4 offline mocked cases**: existing inputs reused without prompts, missing inputs requested through secure-string prompts, proof failure stopping before release validation, and release failure stopping before a PASS report. Newly prompted private values were removed on success and failure; pre-existing private process values were preserved. No real credentials, HTTP calls, proof writes, or builds were used in these four cases.
- At the focused-test checkpoint, the Codex process had no release credentials or real readiness proof. The subsequent owner-run configured validation and inspected evidence are recorded below; credentials were never transferred to Codex or committed.

### Secure configured-validation PowerShell procedure

Run the block below in the owner's interactive PowerShell console, without a transcript, debugger, or shell tracing. Use the existing approved credentials if prompted. Public configuration and exact approval flags are read from the verified repository; existing process values must match them. Existing private process values are reused; only missing token/Leader inputs are requested with masked prompts. No credential store is accessed. Newly prompted private environment values are removed at the end, while values already present before the block are preserved.

The proof command makes one read-only production metadata request. `release:check` runs local validation and artifact generation; it does not deploy, run production migrations, or change roles. The configured builder checks proof freshness during the build, so an over-15-minute run stops rather than bypassing expiry. Stop on any failure; no automatic retry is included. If the full local test run exhausts host memory, close unnecessary applications before a later owner-run validation; no recovery operation is involved.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    Set-Location -LiteralPath 'C:\Users\khale\Desktop\ianalyze-academy\.worktrees\academy-admin-consent-pathb-20261120\frontend'
    $branch = git branch --show-current
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'release/academy-consent-admin-main-20261120') {
        throw 'Wrong candidate branch; stopped.'
    }

    $json = gh variable list --repo khaled-amireh/ianalyze-academy --json name,value 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot verify repository configuration; stopped.' }
    $repo = @{}
    foreach ($item in ($json | ConvertFrom-Json)) { $repo[$item.name] = $item.value }
    $expected = @{
        SUPABASE_PROJECT_ID = 'ocihwiqtgqplwgyhpwjv'
        PRODUCTION_ORIGIN = 'https://ianalyze-academy.pages.dev'
        VITE_SUPABASE_URL = 'https://ocihwiqtgqplwgyhpwjv.supabase.co'
    }
    foreach ($name in @($expected.Keys)) {
        if ($repo[$name] -cne $expected[$name]) { throw "Repository target mismatch: $name" }
    }
    foreach ($name in 'ACADEMY_REGISTRATION_APPROVED','ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED','ACADEMY_LEADERBOARD_APPROVED') {
        if ($repo[$name] -cne 'true') { throw "Approval missing or changed: $name" }
        $expected[$name] = $repo[$name]
    }
    if ($repo['VITE_SUPABASE_PUBLISHABLE_KEY'] -cnotmatch '^sb_publishable_[A-Za-z0-9_-]+$') {
        throw 'Approved browser publishable key unavailable; stopped.'
    }
    $expected['VITE_SUPABASE_PUBLISHABLE_KEY'] = $repo['VITE_SUPABASE_PUBLISHABLE_KEY']
    foreach ($name in $expected.Keys) {
        $current = [Environment]::GetEnvironmentVariable($name, 'Process')
        if ($current -and $current -cne $expected[$name]) { throw "Process configuration mismatch: $name" }
        [Environment]::SetEnvironmentVariable($name, $expected[$name], 'Process')
    }

    $prompted = [System.Collections.Generic.List[string]]::new()
    try {
        foreach ($name in 'SUPABASE_ACCESS_TOKEN','ACADEMY_LEADER_USER_ID') {
            if (-not [Environment]::GetEnvironmentVariable($name, 'Process')) {
                $secret = Read-Host "Existing approved $name (masked)" -AsSecureString
                $ptr = [IntPtr]::Zero
                try {
                    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
                    [Environment]::SetEnvironmentVariable($name, [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr), 'Process')
                    [void]$prompted.Add($name)
                } finally {
                    if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
                    $secret.Dispose()
                }
                if (-not [Environment]::GetEnvironmentVariable($name, 'Process')) { throw "Missing input: $name" }
            }
        }

        node scripts/check-registration-readiness.mjs
        if ($LASTEXITCODE -ne 0) { throw 'Registration proof failed; stopped.' }
        npm.cmd run release:check
        if ($LASTEXITCODE -ne 0) { throw 'Release validation failed; stopped.' }

        Get-Content -Raw -LiteralPath 'artifacts\configured-build.json' |
            ConvertFrom-Json |
            Select-Object project,registration,submissions,leaderboard,privacyApproved,developmentPreviews |
            ConvertTo-Json
        'PASS: registration proof, configured release validation, and Pages artifact checks.'
    } finally {
        foreach ($name in $prompted) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
    }
}
```

Report only the final PASS/FAIL, frontend/database test totals, and the selected non-sensitive build metadata. Do not send environment dumps, credential values, or raw private diagnostics. Successful owner-run validation makes this local follow-up ready for review and separately authorized publication to PR #19; it does not authorize migration execution, initial Admin promotion, merge, workflow activation, or deployment. PR #18 remains untouched.

## Final configured validation and publication review (2026-11-21)

The owner reports **PASS: registration proof, configured release validation, and Pages artifact checks** after running the procedure above in the Path B frontend session. This is the owner's full `npm.cmd run release:check` result; no console transcript was supplied, so new full-suite test totals are not invented. The existing agent-observed 18/18 focused, earlier 92/92 frontend, and 38/38 embedded database/security evidence is retained with its original scope. Completed suites were not repeated for publication.

Local non-secret generated evidence was inspected before publication:

- The v2 proof targets `ocihwiqtgqplwgyhpwjv`, records verified Leader and safe gate definitions, and exactly matches `leaderboard_enabled=true`, `submission_service_enabled=true`, `uploads_enabled=false`. Its verification time is `2026-11-20T23:27:55.432Z` (2026-11-21 02:27:55 Asia/Amman).
- Configured build metadata was written at `2026-11-20T23:28:48.023Z`, approximately **53 seconds** after the proof. Proof validation at the recorded build time passed the unchanged 15-minute contract. Later proof expiry does not invalidate that completed build; a new configured build needs a fresh proof.
- Build metadata confirms registration, notebook submissions, leaderboard, and privacy approval are **true**, and development previews are **false**. The browser-key fingerprint matches the approved repository variable without printing its value. All three approval repository variables were reverified as exactly `true`.
- All **65 files**, totaling **6,463,447 bytes**, match the configured Pages manifest by exact path, byte count, and SHA-256; no extra files or duplicate manifest paths were found. A direct artifact credential-pattern scan passed. The generated artifacts and proof remain ignored and outside the publication scope.
- GitHub `main` and the PR base were reverified at `28d6a7d386f494f53d883998132a35b17330346f`. The local candidate matches exactly **31 approved paths** with all 30 pinned content hashes and applicable baseline hashes verified. The final follow-up is limited to the existing approved paths; no application/migration bytes changed during this evidence update.

**Decision: ready for the authorized PR #19 update and owner merge review.** Deployment and production writes remain gated separately. Immediately before any approved migrations, refresh the read-only migration/schema/RLS/grant/RPC drift, provider/deployment activity, and existing recovery-point freshness checks. Reuse the verified recovery point unless a specific failed freshness/risk gate requires a newer one. Apply only the three Path B migrations in their reviewed order under separate authorization; keep the initial verified Admin grant separate. Deployment route and workflow activation also require explicit authorization. The production workflow must remain disabled throughout this PR-publication operation.

## Production leaderboard RPC compatibility patch (2026-11-21)

This isolated follow-up is based on verified GitHub `main` commit `62ee81b991e87159886b94ef7f6bd2697ea7ff61`, on branch `release/academy-leaderboard-rpc-compat-20261121`. Read-only production inspection established that both `public.academy_leaderboard` and `app_private.academy_leaderboard` have the single contract `(p_weekly boolean DEFAULT false)`. The pending migrations previously replaced only a zero-argument private function, so the public boolean RPC would continue using the pre-consent implementation. The candidate migrations now fail closed unless that observed public/private boolean contract exists and no zero-argument overload exists; they replace the existing signatures without dropping or adding overloads.

Migration `20261119170000_leaderboard_name_consent.sql` now adapts the consent-aware RPC to the live scoring implementation. It preserves weekly and all-time grade totals, award totals, activity counts, current eligibility, pseudonym fallback, and the four-field public JSON shape. Each call captures one scoring timestamp, and the production scoring calendar helpers are used when present. Migration `20261119170200_admin_manual_point_awards.sql` adds the append-only manual-award totals to the existing public RPC using the same period boundaries. Manual points do not inflate activity counts, ineligible/deleted/banned users cannot re-enter through awards, and the existing Admin authorization and idempotency behavior remains enforced. The Admin registry migration is unchanged; the required order remains consent, Admin registry, manual awards. Initial Admin promotion remains separate and unexecuted.

The two SQL files under `frontend/tests/fixtures/production-leaderboard-*.sql` are disposable embedded-database test fixtures only. They model the inspected production function contract and the minimum scoring metadata needed to exercise the captured ranking implementation with synthetic rows. They are not migrations, contain no production data, and are not applied to Supabase. The contract fixture adapts the repository's historical zero-argument embedded baseline only inside the disposable test database; production migrations themselves reject that unsupported baseline before making schema changes. Production compatibility is based on the read-only inspected function definitions, not on changing historical migrations or restoring the older assignment/scoring stack.

### Compatibility patch validation

- Focused command: `node --wasm-num-compilation-tasks=1 --liftoff-only --test --test-isolation=none --test-concurrency=1 tests/leaderboard-consent-admin-awards.security.test.mjs` from `frontend/` — **13/13 PASS**, no skips. This includes a pre-migration failure/no-partial-change assertion for an unexpected zero-argument baseline; exact public/private boolean signature, default and all-time calls; production weekly scoring and Amman boundaries; unchanged pre-existing award totals, activity counts, and archived rankings; consent/withdrawal; Admin-only positive-integer awards; idempotent retries; append-only history; disabled gates; and deleted/banned-user exclusion.
- The earlier full embedded database/security run was **45/45 PASS** before the final two assertions were added to this focused suite. It is not reported as a rerun for this patch.
- Full embedded database/security command: `node --wasm-num-compilation-tasks=1 --liftoff-only --test --test-isolation=none --test-concurrency=1 tests/database.security.test.mjs tests/delivery.security.test.mjs tests/registration.security.test.mjs tests/final-improvements.security.test.mjs tests/leaderboard-consent-admin-awards.security.test.mjs` from `frontend/` — **45/45 PASS**, no skips.
- `npm.cmd run check:types`, `npm.cmd run lint`, `npm.cmd run format:check`, and `npm.cmd run check:database-types` — **PASS**. Preservation: `npm.cmd run check:redesign` — **PASS**, 404 inherited files and 166 explicit hash-pinned resolutions; integrity and source secret scan passed.
- Candidate-local scope is five modified tracked source/test files plus two new test fixtures, this readiness report, and its existing approval manifest: **9 paths** relative to current `main`. No frontend feature/UI, dependency, lockfile, production workflow, credential, or production setting is changed. No file has been staged, committed, pushed, or published.

**Readiness:** the verified RPC-signature incompatibility is corrected in this candidate, and the listed local checks pass. Owner review and separate production authorization remain required. This is not deployed and does not prove migration execution. Before any production migration, separately revalidate live migration/schema/RLS/grant/RPC drift, deployment activity, and applicable recovery-point freshness, then obtain explicit authorization for the three ordered migrations. Initial Admin promotion and deployment remain separately authorized operations. PR #18 and all other worktrees remain untouched.

## Admin MFA assurance correction (2026-11-21)

The isolated follow-up branch `security/admin-aal2-main-20261121` is based on the verified GitHub `main` commit `3b932e93c4d9a1a292cb7526660c46578f45dc26`. It changes only the pending Admin security path and its focused tests/documentation. No production database, account, credential, role, feature gate, workflow, or deployment was changed.

- `app_private.require_admin_aal2()` now requires both the existing verified/registered Admin registry check and the signed JWT `aal = 'aal2'` claim. The private helper has an empty `search_path`. `correct_registered_student_name`, `admin_award_points`, `admin_award_history`, and `admin_award_students` call it. Missing, malformed, or non-AAL2 claims fail closed. The existing `public.academy_leaderboard(p_weekly boolean DEFAULT false)` contract, scoring, consent, RLS, idempotency, and append-only ledgers are unchanged.
- `public.current_academy_is_admin()` remains a membership query so the application can offer step-up, not grant permission. The Admin awards panel now challenges a verified TOTP factor or guides enrollment; all data reads and writes still pass through the server-side AAL2 guards.
- Initial Admin promotion is a two-stage one-time flow. A service-role operator may stage one owner-approved exact UUID/reason in a private RLS-enabled table; that operation does not grant access and is not treated as an AAL2 session. The matching registered, email-confirmed user completes TOTP in the Student dashboard and calls the promotion RPC with a real authenticated AAL2 JWT. The function verifies the account, verified factor, empty registry, approval binding, records the owner-approved actor/reason, consumes approval atomically, and relies on the existing append-only audit trigger. No direct service-role Admin insertion is part of this procedure.
- Database regression coverage includes AAL1, missing and malformed claims, non-Admin and unregistered users, anon/unauthorized RPCs, AAL2 success, TOTP enrollment requirement, target/approval mismatch, one-time consumption and service-role non-execution. Existing weekly/all-time leaderboard, consent, scoring, idempotency and audit assertions remain in the same suite.

### Focused validation

- `node --wasm-num-compilation-tasks=1 --liftoff-only --test --test-isolation=none --test-concurrency=1 tests/leaderboard-consent-admin-awards.security.test.mjs` from `frontend/` — **15/15 PASS**.
- `node --wasm-num-compilation-tasks=1 --liftoff-only --test --test-isolation=none --test-concurrency=1 tests/database.security.test.mjs tests/delivery.security.test.mjs tests/registration.security.test.mjs tests/final-improvements.security.test.mjs tests/leaderboard-consent-admin-awards.security.test.mjs` from `frontend/` — **47/47 PASS**.
- `node --test tests/mobile-responsiveness.test.ts tests/locales.test.ts` from `frontend/` — **5/5 PASS**.
- `npm.cmd run check:types`, `npm.cmd run check:database-types`, focused ESLint, and focused Prettier checks — **PASS**. SQL files have no configured Prettier parser; they were validated through the embedded PostgreSQL migration tests and `git diff --check` instead.

The exact isolated candidate scope is 12 paths: `docs/audits/leaderboard-admin-release/FINAL_READINESS.md`, `docs/audits/leaderboard-admin-release/INITIAL_ADMIN_PROMOTION.md`, `docs/audits/leaderboard-admin-release/approved-pathb-files.json`, `frontend/scripts/database-fixture.mjs`, `frontend/src/features/portal/admin-point-awards.tsx`, `frontend/src/features/portal/initial-admin-promotion.tsx`, `frontend/src/features/portal/student-page.tsx`, `frontend/src/types/database.ts`, `frontend/tests/database.security.test.mjs`, `frontend/tests/leaderboard-consent-admin-awards.security.test.mjs`, `supabase/migrations/20261119170100_application_admins.sql`, and `supabase/migrations/20261119170200_admin_manual_point_awards.sql`.

### Required production order and blockers

After publication/review and separate production authorization, revalidate current drift and applicable recovery evidence, then apply only the ordered migrations: consent (`20261119170000`), Admin registry/AAL2/promotion approval (`20261119170100`), manual awards/AAL2 (`20261119170200`). Verify each migration and RPC signature before continuing. Only after migration checks pass may the owner separately approve staging the exact initial promotion approval. The intended account must finish the AAL2 promotion flow before any Admin use. Deployment remains a distinct authorization and must use the reviewed configured artifact/route.

This branch is locally validated and ready for security review, not production-ready or deployed. Remaining blockers are publication/review of this security correction, refreshed live drift and recovery gates before database writes, separate authorization to apply the three migrations, and separate owner approval of the exact initial Admin target/reason. All production actions remain unperformed; PR #18 and existing worktrees remain preserved.

## Owner-designated role correction (2026-11-21)

Read-only production verification for this follow-up confirmed the owner account remains registered and email-confirmed with underlying Team role, and Hussein remains registered and email-confirmed with Student role. Neither is currently in the Admin registry; neither had a verified TOTP factor at the time of the check. No production role, approval, migration, or deployment was changed here.

The candidate adds two ordered, additive migrations after the three already-applied release migrations:

1. `20261121161428_allow_team_initial_admin_promotion.sql` expands the existing single-use initial Admin flow to registered Student or Team targets. It preserves UUID binding, AAL2, verified TOTP, empty-registry enforcement, atomic approval consumption, and the audit trigger; it never changes `user_roles`.
2. `20261121163359_owner_approved_hussein_team_transition.sql` defines one exact, owner-approved Student-to-Team transition. The staged approval is fixed to the authorized owner and target and the specified reason. The owner must invoke it from a verified authenticated Team session. The role write runs as SECURITY INVOKER under exact-target RLS policies; the existing role-audit trigger records the non-null `auth.uid()`, exact target, and explicit grant reason in `app_private.audit_events`, and an RLS-protected trigger consumes the approval atomically. The additive migration preserves existing audit rows and adds the nullable reason field for future role changes. No general role-management endpoint or service-role impersonation is added.

The Team dashboard contains a target-only panel for Hussein's one-time transition. The owner MFA panel now also supports TOTP enrollment before any Admin approval is staged; completing that MFA step alone cannot grant Admin. After deployment, the exact Admin approval is staged and the owner refreshes the Team dashboard to perform the separate TOTP/AAL2 promotion. The owner retains Team membership when the Admin registry grant is consumed. Hussein's transition panel can be used from the local reviewed candidate after the migrations are applied and its one-time approval is staged, before Cloudflare deployment; do not substitute a direct SQL role update.

Focused verification on this follow-up passed **19/19** tests in `leaderboard-consent-admin-awards.security.test.mjs`, including Student and Team Admin promotion, exact actor/target binding, unauthenticated/service-role denial, RLS scope, one-time consumption, non-null audit actor, grant reason in the application audit event, unchanged other synthetic roles, fail-closed behavior when the target is no longer a Student, and the no-approval TOTP enrollment path that grants no Admin access. TypeScript, focused ESLint, Prettier, `git diff --check`, and the exact-path/hash preservation guard passed. These are local synthetic results only; they do not prove production migration execution or role changes.

### Remaining production sequence

Publish and review the candidate, recheck the exact production target/current role state and pending migration list, then apply only the two additive migrations above through the authorized CLI sequence. Stage the fixed Hussein approval row without changing roles. The owner signs into a secure local candidate session and confirms the one-time Student-to-Team transition; verify the role row, reason, audit actor UUID, and consumed approval. Complete configured artifact and Pages deployment preflight. Immediately before Cloudflare Direct Upload, the owner enrolls and verifies TOTP from the exact-target Team dashboard; without a staged Admin approval this only raises the owner's assurance and does not grant Admin. Deploy the reviewed `main` commit only after confirmation. After deployment, stage the exact single-use Admin approval, then guide the owner to refresh their Team dashboard, perform a fresh TOTP/AAL2 challenge, and consume the approval. Verify the Admin registry, append-only grant event, and consumed approval. No deployment, production migration, approval staging, or role change has yet occurred.

## Pre-deployment regression review (2026-11-21)

### Historical comparison and Week 1

- Compared the local candidate against the available previous-live source commit `b57a26d7eac32004110b0d5aef4a18f6b94281bf`. That source contains the Week1 entry in the Study Plan, both Week1 activity modules, and their routes. Those modules/routes were absent from the consolidated candidate and this is a confirmed consolidation regression.
- Restored the Week1 entry and routes in the candidate. The Study Plan now renders the Week1 entry independently of the intentionally hidden multiweek plan (`SHOW_WEEKLY_PLAN=false`). The Week1 overview links to Activity 1 (dataset) and Activity 2 (Bingo). No Week2 route or activity was added.
- Restored the exact previously applied Week1 migration sources for reproducible local schema only. Read-only production migration history already contains these versions; none was executed or replayed.
- The prior combined assignment/scoring migration was not restored. Week1 submission/review functionality is adapted to the current main schema; obsolete assignment/draft and point-award interfaces are excluded. Published session content uses the current RLS-protected public projection, validates links, and strips unknown/private fields.

### Hussein Team transition control

- The dashboard panel is restricted to a signed-in, email-confirmed Team session whose UUID exactly matches the verified owner UUID. It asks the server whether the fixed Hussein transition approval is still pending. The confirmation button is rendered only when that server check returns true; otherwise the panel shows a status and a read-only status-check control. The action calls only the reviewed owner transition RPC.
- The latest already-observed read-only production evidence shows Hussein is already Team, the owner is Team, the exact approval is no longer pending, and the corresponding single audit event records the owner actor and approved reason. This explains the missing confirmation button: there is no pending transition to confirm. No approval was consumed and no role was changed during this review.
- The control cannot appear in an unconfigured or signed-out public preview. Do not stage another approval or click a transition action for visual checking.

### Feature regression audit

- Preserved public home/about/contact, syllabus, video library, AI-tool guidance, join/login/auth recovery, profile, notifications, student dashboard, Team dashboard, Team grading/feedback, notebook submission gates, leaderboard consent/privacy, Admin AAL2 and manual-award authorization, and Arabic/English copy and direction. Existing feature approvals and the closed legacy upload gate remain in place. These paths are covered by the current frontend and embedded database/security suites; this is not a claim of a live production click-through.
- Intentional boundaries remain: the general week-by-week plan is hidden; only Week1 is exposed. No Week2 content, old assignment/scoring stack, legacy uploads, test awards, new users, Admin grant, or role operation was introduced or performed. Admin actions remain AAL2 protected; the Hussein transition requires the exact owner session and server-pending approval.
- Historical source review is complete from the locally available commit. Direct public-site visual inspection was unavailable in this session (the page fetch was inaccessible and the Windows browser-control pipe was unavailable); the owner should perform the local visual review below.

### Validation after the regression fixes

- `npm.cmd run validate` from `frontend/` — **PASS**: TypeScript, ESLint, 113/113 frontend tests, Prettier, public production build, production boundary, Pages artifact checks, Phase 02 integrity, redesign preservation, Phase 03 preservation, 61/61 embedded PostgreSQL/database security tests, and generated database-type drift check.
- Build/artifact evidence: public build generated the Week1 route chunk and passed the 66-file Pages artifact check. It is intentionally an unconfigured public build with launch approvals disabled.
- Preservation: both `check:redesign` and `check:phase-03` pass with 404 inherited files and 195 exact-path/hash-pinned resolutions. Phase 03 now honors a newer Path B SHA pin only when that exact path is explicitly approved; the original historical hash remains required for every other path. Source secret-pattern scan passed. `git diff --check` passed.
- The owner-reported configured registration proof and `release:check` passed before this regression correction. They must be regenerated/rerun from the existing secure process-only PowerShell handoff after the source changes; no private configuration was available to this validation process, and no production configuration or data was changed.

### Owner local visual review

From the isolated candidate's `frontend/` directory, use the existing secure process-only configuration in the already-open PowerShell and run `npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort`. Visit `http://127.0.0.1:5173/eda`, then `/eda/week-1`, `/eda/week-1/dataset`, and `/eda/week-1/bingo`. Confirm the Week1 card and both activity pages render in Arabic and English; do not submit a dataset or Bingo claim.

For the Team panel, open `http://127.0.0.1:5173/login`, authenticate with the owner's existing account under the approved local configuration, then visit `http://127.0.0.1:5173/workspace`. Given the observed consumed approval and Hussein Team role, expect the panel to say no owner-approved assignment is pending and show the status-check control; the confirmation button should remain absent. Do not click a role-transition action.

No deployment, migration, approval staging/consumption, Admin promotion, award, or production role change was performed. The candidate remains isolated and unpublished.

## Final release preparation and configured-check handoff (2026-11-22)

### Candidate and configuration

- Candidate worktree: `C:\Users\khale\Desktop\ianalyze-academy\.worktrees\production-release-98ad199-20261121`; branch `fix/database-security-owner-transition-20261121`; HEAD `98ad19916269f45c32e689f9226f6b1185bc99b3`. A read-only `git ls-remote` confirmed GitHub `main` still points to this baseline. The candidate has 39 unstaged status entries and no staged files; its existing Week 1, role-transition, and release changes remain intact.
- Read-only GitHub repository-variable inspection returned the ten approved repository-level variables. The three approval flags are `true`; `SUPABASE_PROJECT_ID`, `PRODUCTION_ORIGIN`, and `VITE_SUPABASE_URL` match this production project; the browser publishable key is present and matches the `sb_publishable_` format; and the Cloudflare account/project/production-branch values identify `ianalyze-academy` on `main`. The key value was not printed. Metadata confirms the required repository secrets exist; their values were not read.
- Root cause of the owner's earlier configured-build error: the multi-block PowerShell handoff wrapped `ConvertFrom-Json` output in an array. Under Windows PowerShell 5.1, that shape was counted as one object and the approval-name map was not populated. The code therefore failed closed with “registration closed” and missing-approval messages even though the repository variables were present. The corrected handoff parses GitHub CLI TSV rows, checks every approved target/value and browser-key format, and fails with an allowlisted stage/code.
- Added `frontend/scripts/run-configured-release-check.ps1` as a single-entry, exact-candidate handoff. It reads repository variables without displaying the browser key, prompts via masked input only for missing process-only `SUPABASE_ACCESS_TOKEN` and `ACADEMY_LEADER_USER_ID`, generates the existing SELECT-only registration proof, clears private Management/Cloudflare variables before `npm.cmd run release:check`, restores the process environment, and verifies the configured artifact metadata. It does not modify production or publish an artifact. `frontend/tests/release-check-handoff.test.ts` covers the TSV parser, target/configuration pinning, private input and cleanup, native exit handling, and artifact gates. Both files have exact SHA-256 pins in the existing approved-path manifest.

### Local validation

- Focused handoff test: `node --wasm-num-compilation-tasks=1 --liftoff-only --test --test-concurrency=1 tests/release-check-handoff.test.ts` from `frontend/` — **4/4 PASS**. Windows PowerShell parser check — **PASS**.
- Fresh `npm.cmd run validate` from `frontend/` — **PASS**: TypeScript, ESLint, Prettier, **117/117 frontend tests**, public build, production boundary check, public Pages artifact check (**66 files**), Phase 02 check, redesign preservation/integrity, Phase 03 preservation/integrity, **61/61 embedded database/security tests**, and database type drift check.
- Preservation checks — **PASS**, 404 inherited files and 197 exact-path, hash-pinned integration resolutions; source secret-pattern scan clean. These were run again after the report/hash update. No candidate files were staged.
- The owner-only fresh registration proof and configured `npm.cmd run release:check` have **not** run in this Codex process. This process has no process-only Supabase token or Leader UUID, and no credential was read or prompted for here. The prior proof must not be reused. The owner must run the single-entry handoff below from the existing approved PowerShell context to generate a fresh proof and the configured production build/artifact.

### Cloudflare Direct Upload preflight

- The connected Cloudflare identity reports `khaledamireh55@gmail.com`. Read-only API inspection confirmed project `ianalyze-academy`, `ianalyze-academy.pages.dev`, production branch `main`, no Git source binding, and an ad-hoc Direct Upload deployment. The latest successful production deployment remains commit `b57a26d7eac32004110b0d5aef4a18f6b94281bf` from 2026-11-19; this candidate has not been deployed.
- Wrangler `4.156.0` is installed locally. `wrangler whoami --json` failed because this machine's stored Wrangler authorization is expired and the Codex shell is non-interactive. GitHub metadata confirms `CLOUDFLARE_API_TOKEN` exists but does not expose its value or prove the associated token's current Pages Write permission. Read access to the project does not establish upload permission. Before an authorized Direct Upload, the owner must authenticate Wrangler interactively as the intended Cloudflare account and verify the approved credential has Pages Write (Pages Edit) for this account/project. No upload-token endpoint was called and no deployment was attempted.
- GitHub reports `production.yml` is still `disabled_manually`. The historical run `43097299336` remains queued; it was not restarted, cancelled, or enabled. Manual Direct Upload from a clean, reviewed, published `main` commit is independent of that queued workflow. Do not enable or rerun the workflow.

For the later owner-authorized manual deployment, first sign Wrangler in interactively, verify `whoami --json` identifies the owner and `pages project list --json` lists the exact project, and verify Pages Write on the approved account token/member. From a clean checkout of the exact reviewed `main` commit, after its fresh configured `release:check`, use the locally installed Wrangler command:

```powershell
$branch = (& git branch --show-current).Trim()
$releaseSha = (& git rev-parse HEAD).Trim()
$remoteMain = ((& git ls-remote origin refs/heads/main) -split '\s+')[0]
$dirty = (& git status --porcelain)
if ($LASTEXITCODE -ne 0 -or $branch -cne 'main' -or $releaseSha -cne $remoteMain -or $dirty) {
  throw 'Expected a clean checkout exactly at current origin/main.'
}
& node .\node_modules\wrangler\bin\wrangler.js pages deploy .\dist --project-name ianalyze-academy --branch main --commit-hash $releaseSha --commit-dirty=false --commit-message "Reviewed iAnalyze Academy release $releaseSha"
if ($LASTEXITCODE -ne 0) { throw 'Pages Direct Upload failed; stop and inspect deployment status.' }
```

This is a prepared command only; it must not be run against this dirty candidate. After an approved upload, verify Cloudflare marks the deployment successful on production branch `main` with that exact SHA, then verify the canonical site's index/callback no-store response and the non-destructive feature checklist. Cloudflare documents Wrangler as a supported Pages Direct Upload path and requires Pages Write to create/update Pages content; this project-local Direct Upload route avoids activating the disabled GitHub workflow.

### Admin readiness and remaining release gates

- The manual-award UI is mounted on the Team dashboard but returns no content unless the server confirms application Admin membership. Its sensitive reads and award RPC call require AAL2, and the form validates positive whole-number points, reason, and idempotency. No award was created.
- The initial Admin panel is bound to the owner account and Team/non-Admin state. TOTP enrollment and verification alone only display “Authenticator verified. No Admin access was granted.” Actual promotion remains post-deployment and requires the separately staged UUID-bound single-use approval plus the owner's authenticated AAL2 step-up. Neither enrollment nor promotion was performed here.
- Owner's final pre-deployment MFA step: after configured validation and release publication are ready, sign in to the configured candidate with the existing owner account and open `/workspace`. In the owner-only “Prepare secure Admin authentication” panel, choose authenticator setup, scan the displayed QR directly into the owner's authenticator app, enter the current code only into the Academy prompt, and confirm the UI says the authenticator was verified with no Admin access granted. Do not send or save the QR/code in chat, screenshots, repository files, or logs. If a verified TOTP factor is already present, do not enroll another; confirm the panel recognizes it.
- After a separately authorized deployment, a trusted operator stages the single-use approval for the exact owner UUID and reviewed reason. The owner signs into the live site, refreshes `/workspace`, invokes the promotion panel, and completes the fresh TOTP/AAL2 challenge in their own session. Verify Admin access and retained Team membership. The award panel should then appear after a refresh; inspect its history/list without submitting a test award.
- The three production feature migrations, Hussein's Team transition, and the verified encrypted recovery/offsite readback are reused from the owner's completed evidence; none was repeated. No production data, role, configuration, workflow, or Pages deployment was changed.
- **Deployment decision: NO-GO at this point.** The local code/security validation passes, but a fresh configured registration proof/build is pending owner-private input; Wrangler authentication and Pages Write remain unverified in the local deployment context; and this candidate still has uncommitted changes. Complete the owner handoff, review/publish the exact candidate through the separately authorized release process, then build from the exact reviewed `main` commit. Immediately before deployment, the owner completes/verifies TOTP enrollment without granting Admin. Use the approved Pages Direct Upload only after Wrangler identifies the intended account and write permission is verified. After the separately authorized deployment, stage the one-time owner-bound approval and let the owner perform the AAL2 promotion from the live Team dashboard.

Owner's next local validation command, from the candidate `frontend/` directory and the already-open private PowerShell console:

```powershell
& '.\scripts\run-configured-release-check.ps1'
```

The handoff will use existing process values when present and ask only for missing approved inputs using masked prompts. Do not paste values into chat. A PASS will establish fresh registration readiness, `release:check`, and a configured Pages artifact for this candidate; it will not publish or deploy it.

## Owner-confirmed configured validation and final publication review (2026-11-22)

The owner reports that the exact candidate completed a fresh configured validation after the Week 1 and owner-transition fixes. This newer evidence supersedes the earlier pending-proof statement above. The successful check was not repeated.

- Registration readiness: **PASS** at execution time.
- `release:check`: **PASS** — 117/117 frontend tests; 61/61 embedded database/security tests; TypeScript, ESLint, formatting, preservation and database types all passed.
- Configured production build and Pages artifact: **PASS**, 68 files. Owner-confirmed gate metadata: registration, submissions, leaderboard and privacy approval `true`; development previews `false`.
- This is owner-reported execution evidence. No additional credentials were read, and no production writes, migrations, role changes, workflow activation or deployment occurred.

### Candidate diff and GitHub publication state

- GitHub `main` remains at `98ad19916269f45c32e689f9226f6b1185bc99b3`. The isolated branch is `fix/database-security-owner-transition-20261121` at that same HEAD, with **39 unstaged paths and zero staged paths**. Every changed/untracked path other than the approval manifest itself matches its exact SHA-256 approval pin; the preservation and source-secret checks passed. The scope consists of the readiness/approval records, release-test wiring and handoff, Week 1 routes/content/components/translations/types/security tests, the exact-owner transition UI/access test, and three historical Week 1 migration sources. There are no lockfile, environment, credential, backup, generated-build, or unrelated workflow changes. The historical migrations are source recovery for versions already applied; they are not newly pending production migrations.
- The substantive diff preserves the hidden multiweek-plan gate while exposing only Week 1 and its Dataset/Bingo activities, keeps Arabic RTL and English LTR, adapts session/submission behavior to the current schema, and adds the Week 1 database/security tests to the normal embedded suite. The owner-transition UI is gated to the exact verified owner Team session, asks the fixed RPC whether the approval is pending, and only offers confirmation for a server-confirmed pending approval; server authorization/audit remains authoritative. No generic role editor or Admin bypass is introduced.
- GitHub confirms the classic `main` branch-protection endpoint returns “Branch not protected”; the repository rulesets query is empty. The active Actions workflow is the manual-only read-only credential preflight. `production.yml` is still `disabled_manually`; its push trigger includes `main`, but it was not enabled. The old run `43097299336` remains queued, unchanged. It was not cancelled or rerun. The candidate branch does not match the production push trigger, and the later Direct Upload path does not depend on that queued Actions run.
- No automatic PR validation workflow is configured. The owner should review the exact 39-path diff and local validation evidence in the PR. The disabled production workflow must remain disabled.

### Exact publication and merge sequence (not executed)

1. With separate publication authorization, stage exactly the 39 current reviewed paths and verify the staged list and diff. Proposed commit message: `feat: restore Week 1 and secure owner transition`.
2. Create one commit on `fix/database-security-owner-transition-20261121`, push only to `https://github.com/khaled-amireh/ianalyze-academy.git`, and open a PR from that branch to `main`. Proposed title: `Restore Week 1 and secure owner transition`.
3. Owner reviews the 39-path PR diff and existing validation evidence. Do not merge until that review is accepted and the owner separately authorizes merge; branch protection and automatic PR checks will not enforce this process.
4. After merge, verify the exact `main` SHA and compare its Git tree with the validated candidate commit. Reuse the owner-validated 68-file configured artifact if the tree is identical and the artifact remains unchanged; do not repeat `release:check` solely for a different commit SHA. If the final tree or artifact differs, rerun configured validation from the final source before deployment.

### Cloudflare and remaining owner actions

- The current Cloudflare connector identity matches the owner account and can read the exact project. Project metadata still identifies `ianalyze-academy.pages.dev`, production branch `main`, Direct Upload (no Git source binding); latest successful production deployment remains commit `b57a26d7eac32004110b0d5aef4a18f6b94281bf` from 2026-11-19.
- Local Wrangler `4.156.0` still reports its stored authorization expired in the non-interactive Codex shell. The repository secret exists by metadata, but its value/scope was not accessed. The owner must run `node .\node_modules\wrangler\bin\wrangler.js login` interactively, then `whoami --json` and `pages project list --json`, and confirm the intended account has Pages Write for the project. Pages API read access alone is not proof of upload permission. Cloudflare's Direct Upload documentation supports `wrangler pages deploy`; creating a deployment requires Pages Write ([Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/), [Pages API permissions](https://developers.cloudflare.com/pages/configuration/api/)).
- No deployment is authorized by this review. Immediately before a later separately authorized deployment, the owner completes or confirms verified TOTP enrollment from the owner-only Team Dashboard panel. Enrollment alone does not grant Admin. After the deployment, use the reviewed exact-UUID, single-use approval and the owner's own AAL2 session for promotion; verify Admin and retained Team membership, then confirm the manual-award panel appears without creating a test award.
- The immediate authorization needed is to publish the exact 39-path branch as one commit and a PR for review only. Merge and Cloudflare Direct Upload remain separate owner decisions. Existing migration, Team-role, backup/restore, and offsite-readback evidence remains reused; no new backup or migration is needed for this publication.

**Final status:** local and configured release validation are **PASS** by owner-confirmed evidence; production deployment remains **NO-GO** until the candidate is published/reviewed/merged, the final source tree is confirmed against the validated artifact, and Wrangler owner authentication plus Pages Write are verified. No production change has been made.
