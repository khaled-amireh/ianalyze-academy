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

## Phase 2 consolidated feature implementation (2026-11-22)

### Candidate scope and result

- Isolated candidate: `.worktrees/phase2-consolidated-20261122`, branch `release/phase2-consolidated-20261122`, based on `be870c7d087d10d32d0a776cc6352d32e661387b`.
- The consolidated implementation currently has **36 changed or new paths**: 35 exact-path SHA-256 entries plus this manifest, which is self-exempt because an approval record cannot hash itself. No candidate files were staged, committed, pushed, merged, or published.
- The manifest `docs/phase-05/approved-consolidated-features.json` pins those 35 paths to the reviewed base and the current approved content. The preservation guard passes; it has not been weakened.

### Implemented features

- The desktop and mobile primary navigation share one Leaderboard link. The page defaults to All-Time, offers Weekly/All-Time views, displays the authoritative Asia/Amman week as an inclusive date range, adds medal podiums and the full ranking table, and shows only a server-generated `is_you` boolean for the signed-in student's own row. Exact performance ties share a rank; hidden stable ordering does not change the displayed rank or expose student IDs.
- Week 1 displays the localized `Completed / مكتمل` program-week indicator. Week 1 Dataset, Bingo, notebook uploads, grading and Kaggle validation remain on their existing paths. The student and staff activity views expose Week 1 only; no Week 2 activity or route was introduced.
- Team-authorized staff can create/edit drafts, configure bilingual instructions, rubric, publication state, opening/deadline, limits and timing phases, publish/unpublish under existing database rules, review work, request a permitted resubmission, grade/publish feedback, archive history, or delete only an unused draft. Published activities are mounted in the registered Student learning plan.
- General activities support private PDF, CSV, XLSX, XLS, IPYNB, PNG, JPG/JPEG and TXT submissions. The candidate defaults to at most 3 files, 10 MiB each, in a private `activity-submissions` bucket. Reservation-bound paths, per-user RLS, no overwrite, content and SHA-256 checks, resumable idempotent uploads, progress, retry and cancellation are enforced across client, database and the authenticated Edge handler. The existing notebook bucket remains at 256 KiB.
- Staff configure three ordered, nonoverlapping Asia/Amman phases and nonincreasing per-activity bonuses. The database records the verified finalization time and phase, snapshots scoring-critical settings, and computes `min(activity maximum, rubric grade + configured phase bonus)`. Deadline, phase-boundary, score-cap, revision and leaderboard tests pass. Edits to scoring/content lock after the first submission; archived work and published academic history remain preserved.

### Validation evidence

From `frontend/`, `npm.cmd run validate` completed successfully:

- TypeScript and database types: **PASS**.
- ESLint and Prettier: **PASS**.
- Frontend tests: **126/126 PASS**.
- Embedded PostgreSQL/database security tests: **73/73 PASS**.
- Public Vite production build: **PASS**; Pages artifact: **66 files PASS**; production boundary check confirms no source maps, local backend configuration, or credential patterns in the artifact.
- Phase 02, redesign preservation and Phase 03 checks: **PASS**. The final preservation run reported 405 inherited files and 209 explicit hash-pinned integration resolutions. Source secret-pattern scan passed; `git diff --check` is clean.
- Focused checks are also included in the full suites: upload validation and Edge-handler source contract, private-file RLS/finalization, grading-to-leaderboard totals, own-row privacy, exact tie ranks, Week 1 scope, time-zone conversion and phase boundaries.

The artifact above is the unconfigured public/local-safe build, not a configured production artifact. A fresh registration proof and configured `release:check` were not available or run here.

### Local Supabase integration limit

A read-only check confirmed the existing local Supabase database had zero Auth users, profiles, weeks, activities, submissions, grades and Storage objects. The pinned CLI was invoked with `migration up --local --workdir .` only. It applied the three pending Week 1 migrations, then stopped at `20261119170000_leaderboard_name_consent.sql` because this local schema lacks the reviewed production `academy_leaderboard(boolean)` baseline. The failing migration did not apply. The local migration history now reflects those three local applications and keeps the remaining six migrations pending; the local data counts remain zero. No `--linked` command or hosted target was used.

The embedded PostgreSQL suite uses the repository's synthetic production-contract fixture and validates the complete database lifecycle, but a browser-to-live-Edge-runtime upload/review workflow was not run: Deno is not installed and the local Edge Runtime service is stopped. A static Edge-handler contract test verifies authenticated identity and Student role checks occur before service-role use, feature gates are checked, file contents are verified before finalization, and raw exceptions are not returned. This is an operational test-environment limitation, not a production verification claim.

### Security and release boundary

- Activity creation, grading, publication, archive/delete eligibility, score calculation, file reservation/finalization and leaderboard totals are enforced by the database/Edge service; client visibility is not the authorization boundary.
- The new Storage bucket is private, with scoped object policies; submissions and grading records are not publicly exposed. Existing name-consent and Admin AAL2/manual-award protections are preserved by the migration/test baseline.
- `supabase/config.toml` sets the **local** Storage ceiling to 10 MiB for local testing. No hosted Storage limit, bucket, Edge secret or origin configuration was changed or certified here. Before hosted activation, verify the account-wide file-size limit permits 10 MiB, the bucket is private and correctly configured, and the Edge function's approved origin and upload gate are configured.
- No production migration, deployment, role change, account, submission, grade, award, backup or workflow action occurred. The candidate is ready for code/security review, not deployment authorization. The new migration is prepared only; before any hosted database write, use the project's standing recovery-freshness policy and separate migration approval. Do not request a backup for ordinary code review or frontend-only work.
- Built JavaScript is minified and no source maps are shipped by the checked artifact, but browser-delivered code remains inspectable; authorization and scoring stay server-side.

### Remaining review/activation steps

1. Owner reviews the consolidated candidate diff and the new migration plus Edge function.
2. Separately authorize any publication/merge and hosted migration/deployment sequence.
3. Before hosted file submission is enabled, confirm the hosted Storage limit/bucket and Edge origin/secret configuration using read-only provider checks; deploy the Edge function and apply the reviewed migration only through the approved sequence.
4. Perform a non-production browser-to-Edge E2E workflow with isolated identities and private test files when a complete local Edge Runtime/baseline is available. No student production activity should be fabricated for verification.

**Phase 2 status:** Candidate-local implementation and the local validation suite **PASS**. Hosted activation and the browser-to-Edge runtime E2E remain unverified. No production change has been made.

## Final focused review and release readiness (2026-11-22)

### Candidate and corrections

- Reviewed candidate: branch `release/phase2-consolidated-20261122`, base/HEAD `be870c7d087d10d32d0a776cc6352d32e661387b`; 36 changed paths in the isolated worktree (35 exact-path SHA-256 pins plus the self-exempt approval manifest). Nothing was staged, committed, published, merged, or deployed.
- Confirmed and fixed two issues in the candidate migration. First, `app_private.delete_activity_draft(uuid)` now locks the activity row before checking draft status and dependent submissions/grades, serializing deletion with publication and submission reservation. Second, `public.activity_submission_files` now grants `service_role` **SELECT only**, which the deployed Edge handler needs to verify file manifests; authenticated access remains subject to RLS and anonymous access remains denied. No write privilege was granted to `service_role` on this manifest table.
- Added regressions for row-lock ordering and for anonymous/authenticated/service-role manifest access. The reviewed preservation manifest was updated with exact hashes and reasons for these candidate-local changes; the guard was not weakened.

### Validation

- Focused after-fix tests: `node --test tests/activity-management.test.ts` **10/10 PASS**; `node --test tests/activity-submissions.security.test.mjs` **9/9 PASS**.
- `npm.cmd run release:check` completed the full validation phase: TypeScript, ESLint, frontend tests **127/127**, Prettier, public artifact checks (**66 files**), phase checks, embedded PostgreSQL/database security tests **73/73**, database type checks, preservation/integrity (**405 inherited files; 209 pinned resolutions**) and source-secret scan all **PASS**. The later configured production build stopped safely because the current process did not provide the verified production URL and browser-safe publishable key. Therefore the overall configured `release:check` is **BLOCKED**, not a complete PASS. The public-only artifact is not a substitute for a configured production artifact.
- Fresh `node scripts/check-registration-readiness.mjs` did not produce proof: it stopped before any network request because the process did not contain the approved project ID and production origin required by `requireSupabaseTarget()`. No registration proof or configured build artifact was generated in this run.
- The prior local activity/file E2E remains unperformed. The local Supabase stack is stopped, its migration baseline is incomplete, and no Deno CLI is installed. A safe E2E is feasible with an isolated local Supabase/Edge stack, synthetic test identities and files, and a schema matching current production; it must not use production student data. Until that environment is aligned and the flow is run, browser-to-Edge upload/review behavior remains unverified.

### Read-only hosted findings and migration lineage

- Read-only Supabase project check: project `ocihwiqtgqplwgyhpwjv` is `ACTIVE_HEALTHY` on Postgres 17.11. The remote migration history has 22 entries. The production `public.academy_leaderboard(boolean)` RPC exists, with no incompatible zero-argument overload. The application dependencies inspected for this migration are present, and the new `20261122120000_dynamic_activity_submissions.sql` is the sole candidate migration not in remote history. Production gates observed were submissions enabled, leaderboard enabled, and legacy uploads disabled. No production write was made.
- The candidate's local historical SQL directory is incomplete: it lacks eight sources for versions already recorded remotely: `20261111182137_backup_prelaunch_registration_accounts_20261111`, `20261115115043_assignments_points_session`, `20261115123220_assignment_link_validation`, `20261115130948_private_form_drafts_assignment_retry`, `20261115172318_eligible_student_leaderboard`, `20261115193059_weekly_archives_release_readiness`, `20261115195955_archive_privacy_rank_preservation`, and `20261115203156_rankings_closed_gate`. The specific local `academy_leaderboard(boolean)` mismatch is not present on hosted production, so that contract failure is a local-baseline issue. However, running a normal CLI migration deploy directly from this incomplete candidate directory is a genuine lineage/deployment risk. For any later migration release, use an ACL-protected temporary CLI workspace fetched from the authorized project, verify all 22 applied migration records/sources, add only the reviewed pending migration, and require a dry run listing exactly `20261122120000_dynamic_activity_submissions` before separately authorized execution. Do not repair history, fabricate SQL, or reset the database.
- Hosted Storage metadata showed `student-submissions` private with a 20 MiB bucket limit and `team-materials` private with a 1 MiB limit; the candidate's `activity-submissions` bucket is not yet present. The read-only object inventory returned zero objects at check time. The candidate migration creates a private 10 MiB activity bucket. The provider connection did not expose the project-wide Storage upload limit or Edge Function secret values/presence, so those remain **UNVERIFIED**. Before enabling the feature, confirm the account-wide limit permits at least 10 MiB, confirm the created bucket is private with the reviewed limit, and verify the Edge configuration has the exact production-origin allowlist and `ACADEMY_UPLOADS_ENABLED` value. Do not disclose or copy any secret values. Existing bucket limits are configuration observations, not proof of the project-wide cap.

### Production activation and recovery plan (not executed)

1. Owner supplies the approved configuration through the existing private, process-only PowerShell handoff from this candidate's `frontend/` directory: verified `SUPABASE_PROJECT_ID` and `PRODUCTION_ORIGIN`; `VITE_SUPABASE_URL` and browser-safe `VITE_SUPABASE_PUBLISHABLE_KEY`; registration approval and verified Leader UUID plus `SUPABASE_ACCESS_TOKEN`; and the three approved build flags for registration, notebook submissions, and leaderboard/privacy. Do not paste values into chat or tracked files. Run `node scripts/check-registration-readiness.mjs` immediately followed by `npm.cmd run release:check`; proof is valid for 15 minutes. Require a fresh proof and a configured artifact whose manifest and gate metadata match the approved values.
2. Complete the isolated browser-to-Edge E2E with synthetic identities/files before enabling real activity submissions. Review the hosted Storage global limit, private bucket, Edge origin allowlist, function secret presence/configuration, and function deployment settings read-only first.
3. For database activation, recheck production drift and that the already verified encrypted/offsite recovery evidence still meets the standing freshness policy. No new backup is required for this code review; create one only if the policy or a genuine recovery failure requires it. Prepare the full-history temporary migration workspace and dry-run exactly the single new migration. Obtain separate authorization before applying it.
4. Under a separately authorized release sequence, apply the one reviewed additive migration, verify history/schema/RLS/grants/bucket and function dependencies, then deploy the `activity-submit` Edge Function with the reviewed origins and fail-closed upload gate. Build and Direct Upload the configured Pages artifact from the exact reviewed/merged source. Keep the disabled GitHub production workflow disabled.
5. If verification fails before any activity data is accepted, close the feature gate and roll back the Pages/Edge release to the last known good version; leave the additive schema/bucket in place rather than dropping them. If activity submissions have been accepted, preserve their records and private objects; use a forward fix or a reviewed restore plan, never destructive rollback. Verify existing Week 1, leaderboard, Team grading and Admin AAL2 boundaries after release without creating production test accounts, submissions, grades, or awards.

### Final gate status

| Area                                             | Status                                           | Evidence / remaining condition                                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate code and database security             | **PASS**                                         | Two confirmed defects fixed; focused tests and embedded security suite pass.                                                                    |
| Local automated validation                       | **PASS**                                         | Full `release:check` validation phase and preservation/integrity checks pass.                                                                   |
| Fresh registration proof                         | **BLOCKED**                                      | Target variables were absent/mismatched in this process; no proof was emitted. Use the owner-controlled secure handoff.                         |
| Configured production build                      | **BLOCKED**                                      | Verified production URL and browser-safe publishable key were unavailable in this process.                                                      |
| Hosted RPC/dependencies/feature gates            | **PASS**                                         | Read-only observations above; recheck immediately before any write.                                                                             |
| Hosted Storage capacity and new bucket           | **UNVERIFIED**                                   | No candidate bucket yet; project-wide size cap is not exposed by the available provider access.                                                 |
| Edge origins and required function configuration | **UNVERIFIED**                                   | Secret/configuration presence cannot be inspected with the available read-only connector.                                                       |
| Browser-to-Edge upload/review E2E                | **BLOCKED**                                      | Local stack is stopped and baseline incomplete; run with isolated synthetic data after environment alignment.                                   |
| Migration lineage                                | **BLOCKED for direct CLI deploy from candidate** | Eight applied historical SQL sources are absent locally. Use the verified full-history temporary CLI workspace and exact-one-migration dry run. |
| Production changes/deployment                    | **NOT AUTHORIZED / NOT PERFORMED**               | No production mutation, migration, Edge deployment, Pages deployment, workflow activation, account/role change, or backup occurred.             |

**Decision:** The candidate is ready for owner code review, but **not ready for production activation or deployment**. The concrete blockers are fresh secure registration/configured-build evidence; hosted Storage global-cap and bucket verification; Edge origin/configuration verification; isolated browser-to-Edge E2E; and the exact full-history migration dry run. No new backup is requested for routine code review. Production writes require separate authorization after the applicable recovery-freshness gate passes.

## Phase 2 final readiness follow-up (2026-11-22)

### Configured validation handoff

- The candidate-bound PowerShell handoff is `frontend/scripts/run-configured-release-check.ps1`. It pins the exact Phase 2 worktree, branch, remote, base SHA, and GitHub owner identity; retrieves only the approved repository variables; prompts with masked input only for missing private readiness inputs; clears management credentials before `npm.cmd run release:check`; restores the process environment afterward; and checks the resulting configured artifact gates. Focused handoff tests pass **4/4**.
- Read-only GitHub CLI verification succeeded as `khaled-amireh`. Repository variables for project, production origin, Supabase URL, registration/submission/leaderboard approvals, Cloudflare account/project/branch all matched the handoff's expected values; the browser-safe publishable key is present in the expected format. The only missing process-only inputs are `SUPABASE_ACCESS_TOKEN` and `ACADEMY_LEADER_USER_ID`. Their values were not accessed or emitted, so fresh registration proof and configured `release:check` were not run here. The minimum owner command is:

  ```powershell
  Set-Location -LiteralPath 'C:\Users\khale\Desktop\ianalyze-academy\.worktrees\phase2-consolidated-20261122\frontend'
  & '.\scripts\run-configured-release-check.ps1'
  ```

  Run it in the owner's authenticated PowerShell where `gh` is logged in as `khaled-amireh`. It reuses existing process values and privately prompts only when needed. Do not paste values into chat. The script runs the fresh registration proof immediately before the configured release check.

### Migration lineage and dry-run evidence

- An ACL-protected temporary workspace at `%LOCALAPPDATA%\Temp\ianalyze-academy-phase2-review-20261122` (protected DACL: owner, SYSTEM and Administrators only) contains the official Supabase CLI **3.2.0** fetch of the authorized project's **22** applied migration sources plus the one candidate migration. An independent SHA-256 pass matched all **22/22** fetched sources to the workspace provenance record; the candidate migration hash matches the approved candidate manifest. Provenance records **14 byte mismatches** between fetched historical sources and overlapping files in the candidate's local directory, so use only the protected fetched workspace for any later CLI migration operation; the candidate's migration files were not replaced.
- The production-targeted CLI dry run listed exactly one pending migration, `20261122120000_dynamic_activity_submissions.sql`, with no other migration or seed operation. A read-only follow-up at **2026-11-22 11:01:36 UTC** confirmed production migration history still contains **22** rows; no migration was applied. The local history baseline is prepared, but its migrations were not run against an existing local database.
- **CLI side effect to review:** the CLI dry run bootstrapped a production role `cli_login_postgres`. Read-only catalog inspection confirmed it is expired (`rolvaliduntil` is in the past), is not superuser/createdb/createrole/replication/BYPASSRLS, has no roles granted to it, and is a member of `postgres` with `SET ROLE` allowed and no admin option. The role remains in the catalog; it was not removed. Do not perform further remote CLI operations or clean up the role without explicit owner authorization. This does not change migration history, but it is a production authentication-role artifact that must be disclosed during release review.
- One fetched historical migration copies existing Auth/profile/role rows into a private backup table. Any future local E2E bootstrap must use a newly isolated empty database, verify it has zero Auth users before applying historical migrations, and create only synthetic test identities afterward. Never replay this history onto an existing local stack.

### Hosted storage and Edge configuration

- A current read-only aggregate query found the existing `student-submissions` and `team-materials` buckets are private, each has **0 objects**, and their limits are **20 MiB** and **1 MiB** respectively. The new `activity-submissions` bucket is not present because its migration has not been applied; the reviewed migration creates it private with a **10 MiB** per-object limit. The provider view does not expose the project-wide Storage cap, so capacity for that new limit remains **UNVERIFIED**.
- The deployed Edge inventory contains `notebook-submit` (active, version 17); `activity-submit` is not deployed. Read-only secret-name listing shows `ACADEMY_ALLOWED_ORIGINS` and `ACADEMY_UPLOADS_ENABLED` exist, but their values were not read, so exact origin allowlisting and upload-gate state remain **UNVERIFIED**.

### Local E2E and recovery-point status

- The temporary isolated migration workspace is ready for local setup, but the synthetic browser-to-Edge E2E was **not run**. At the latest host check, free RAM was **1.62 GiB**, below the established **2 GiB** minimum; Docker already had four Supabase stacks and 25 containers running. Disk had **77.69 GiB** free. No existing containers or local databases were stopped, reset, or modified. Defer starting another stack until the owner has freed RAM above the gate; then use only a new isolated project/ports and synthetic data.
- Drive metadata for the approved folder shows an encrypted package matching the owner-reported offsite-readback size (**1,280,963 bytes**) was created **2026-11-21 13:40:41 UTC**. This is recent by age (about 21 hours at metadata review); the owner previously reported the matching SHA-256 readback PASS. This review checked metadata only and did not download or rehash the package. The repository does not state a numeric recovery-point age limit, so freshness against that formal threshold must be reconfirmed immediately before any production database write; this review does not request a new backup.

### Final gate matrix

| Area                                      | Status                                  | Finding                                                                                                                                                                                                                                          |
| ----------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Candidate review/preservation             | **PASS**                                | Candidate scope remains isolated and unstaged; preservation guard reports 405 inherited files and 209 hash-pinned resolutions.                                                                                                                   |
| Fresh registration proof/configured build | **OWNER MASKED INPUT**                  | Repository variables are verified; the owner must supply the missing access token and Leader UUID through the handoff's masked process-only prompts.                                                                                             |
| Hosted migration baseline                 | **PASS WITH CLI SIDE EFFECT**           | 22/22 fetched-source hashes match; the exact one-migration dry run passed; production still has 22 history rows. The expired temporary login role remains and needs owner review.                                                                |
| Storage bucket and object inventory       | **PARTIAL**                             | Current buckets are private and empty; candidate bucket is absent until authorized migration; global upload cap is unexposed.                                                                                                                    |
| Edge function/configuration               | **PARTIAL**                             | New `activity-submit` is not deployed; required secret names exist, but secret values/origin allowlist cannot be verified without reading them.                                                                                                  |
| Browser-to-Edge synthetic E2E             | **BLOCKED**                             | Host RAM is below the minimum; do not start another stack at the observed capacity.                                                                                                                                                              |
| Recovery freshness                        | **RECENT; POLICY THRESHOLD UNVERIFIED** | Previously verified offsite package is about 21 hours old; confirm the applicable age cutoff at the actual production-write gate.                                                                                                                |
| Production activation                     | **NOT AUTHORIZED / NOT PERFORMED**      | No migration, bucket creation, Edge/Pages deployment, workflow activation, backup, upload, or application configuration change was performed. The only observed production-side effect was the expired temporary CLI login role described above. |

**Decision:** The candidate is ready for owner review, but **not ready for production activation**. Complete the configured validation in the owner PowerShell, resolve/review the expired CLI login-role artifact, verify the project Storage cap and Edge-origin/upload-gate configuration without disclosing values, run the isolated synthetic E2E after the RAM gate is met, and confirm recovery freshness against the actual policy before separately authorizing the one migration and subsequent Edge/Pages release. No new backup is needed solely for this candidate review.

## Phase 2 final blocker resolution (2026-11-22)

This update supersedes the earlier configured-validation and host-resource statuses above. It records the owner-confirmed configured run and the focused read-only provider/resource review. No application, migration, database, storage, role, Edge, Pages, or workflow changes were made for this follow-up. The candidate remains on `release/phase2-consolidated-20261122` at `be870c7d087d10d32d0a776cc6352d32e661387b`; existing candidate edits and other worktrees were preserved.

### Configured validation (owner-reported)

- The owner reports that the fresh registration proof and configured `npm.cmd run release:check` both passed: frontend **127/127**, embedded database/security **73/73**, TypeScript, ESLint, formatting, preservation, integrity and database types passed; the configured production build and **70-file** Cloudflare Pages artifact passed verification.
- The owner-reported artifact metadata has registration, notebook submissions, leaderboard and privacy approval enabled, with development previews disabled. This result supersedes the older 126-test/66-file and missing-process-configuration statuses earlier in this report. The checks were not rerun because no implementation or build inputs changed in this follow-up; the execution transcript was not independently reproduced here.

### Hosted Storage, Edge, and migration evidence

- Read-only inspection at **2026-11-22 12:00 UTC** found 22 applied production migration records. All 22 source records matched the protected CLI-fetch provenance; the approved candidate migration `20261122120000_dynamic_activity_submissions.sql` is the sole pending migration, and the prior production-targeted dry run listed exactly that migration. The dry run was not repeated because it had created the temporary login role described below. No migration was applied. Preserve the protected full-history CLI workspace for a future authorized migration operation.
- The existing `student-submissions` and `team-materials` buckets remain private and had zero objects, with respective bucket limits of 20 MiB and 1 MiB. `activity-submissions` is absent until the migration is authorized and applied; that migration defines a private bucket with a 10 MiB per-object cap. Supabase documents that Free projects can configure a global maximum of up to 50 MB and that a bucket limit cannot exceed the configured global limit; this is a plan maximum, not evidence of this project's actual setting. The effective project-wide limit remains **UNVERIFIED** and must be confirmed in Storage Settings as at least 10 MiB before activation ([Supabase Storage upload limits](https://supabase.com/docs/guides/storage/uploads/file-limits)).
- The deployed Edge inventory contains active `notebook-submit` v17; `activity-submit` is not deployed. Secret-name metadata confirms `ACADEMY_ALLOWED_ORIGINS` and `ACADEMY_UPLOADS_ENABLED` exist, but their values were not read. Candidate code checks exact allowed origins and handles browser preflight; the intended Pages origin is `https://ianalyze-academy.pages.dev`. The actual hosted allowlist and upload-gate values remain **UNVERIFIED**. Supabase requires browser-invoked Edge Functions to handle CORS preflight ([Supabase Edge Function CORS guidance](https://supabase.com/docs/guides/functions/cors)); verify the exact origin and required request headers through an owner-controlled settings review without disclosing secret values.
- The existing `deploy-supabase-edge.mjs` targets only `notebook-submit` and turns the notebook upload gate off; do not use it for this new function. The reviewed CLI supports deploying a named function to an explicit project. After migration and owner approval, deploy only `activity-submit` to the authorized project, with its reviewed explicit-auth handler configuration, and do not use `--prune` or an all-functions deployment. The handler performs its own token/user/role checks; `verify_jwt=false` is intentional for this handler's additional application checks. The current function must remain fail-closed until the exact origin and upload-gate configuration are verified.

### Temporary CLI role security review

- Read-only catalog evidence at approximately **2026-11-22 12:00 UTC** still found `cli_login_postgres`: `LOGIN` is enabled; the password `VALID UNTIL` time has elapsed; it has no superuser, role-creation, database-creation, replication, or `BYPASSRLS` attribute; it owns no objects, has no active sessions, and has no observed ACL dependencies. It is a member of `postgres` with the `SET` option, while inheritance and admin options are disabled.
- PostgreSQL specifies that `VALID UNTIL` expires a password, not the role, and does not constrain non-password authentication; `SET ROLE` is permitted when membership has the `SET` option ([PostgreSQL 17 `CREATE ROLE`](https://www.postgresql.org/docs/17/sql-createrole.html), [PostgreSQL 17 `SET ROLE`](https://www.postgresql.org/docs/17/sql-set-role.html)). Therefore the password-authentication expiry does **not** prove that the login role is unable to authenticate by every supported method. If it authenticates, the membership enables it to assume `postgres`. Its creation during the earlier CLI dry run makes a temporary CLI artifact likely, but its precise provider lifecycle and available authentication methods were not established.
- This is a **production security blocker**, not a migration-history mismatch. Do not issue another CLI dry run merely to recheck it. Before production activation, the owner must either obtain provider-backed confirmation that no authentication method can use the role and that it is safely transient, or separately authorize a narrow mitigation. The least disruptive candidate is `ALTER ROLE cli_login_postgres NOLOGIN` after rechecking the exact role, zero active sessions, and absence of ownership/dependencies; verify `rolcanlogin=false` and unchanged migration history immediately afterward. Do not execute this correction without separate authorization, and account for the CLI possibly recreating its temporary role during a later migration operation.

### Synthetic local E2E and recovery point

- At **2026-11-22 12:06 UTC**, host RAM was **1.45 GiB free / 11.38 GiB total**, below the reviewed **2 GiB minimum**. The C: volume had **83.91 GiB free**. Docker Desktop's Linux engine was reachable (server 29.9.2; reported engine memory about 5.48 GiB); 25 containers were running and no container was stopped, reconfigured, or removed. The synthetic browser-to-Edge E2E was **not run** because host RAM failed its gate. Free host RAM above 2 GiB is required before starting an additional isolated stack; disk capacity is sufficient for the current local test plan.
- The approved Drive folder metadata showed the encrypted package size **1,280,963 bytes**, created **2026-11-21 13:40:41 UTC**. The owner previously reported SHA-256 `60978D0121D1CCA50CAFE0635DCCBC989C4ED4FEFB1C7D97103982EC9121E358`, isolated restore and portable recovery PASS, and an independent offsite readback PASS. This follow-up verified metadata only; it did not download or rehash the package or repeat the restore.
- No numeric recovery freshness cutoff was found in the repository. As a proposal for owner approval—not an existing policy—use a maximum age of **72 hours** for this additive schema/private-bucket migration and **24 hours** for destructive or data-rewriting operations. The reported package age is roughly **22.5 hours** at this review and lies within the proposed 72-hour window, but the actual migration gate must refresh package metadata, production drift and Auth/Storage inventory immediately before execution. No new backup is required solely for this code review.

### Updated readiness matrix

| Area                                | Status                           | Finding / next condition                                                                                                                                                                                                                              |
| ----------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate configured validation     | **PASS (owner-reported)**        | Fresh registration proof, configured release check, 127/127 frontend tests, 73/73 database/security tests, build, preservation checks, and 70-file Pages artifact reported PASS. Not rerun because implementation did not change.                     |
| Hosted migration baseline           | **PASS WITH RESIDUAL ROLE RISK** | 22/22 fetched sources match provenance; one exact reviewed migration is pending; previous dry run matched it. No migration was applied. Resolve or obtain provider-backed assurance for `cli_login_postgres` before production activation.            |
| Storage policy and bucket readiness | **PARTIAL**                      | Existing buckets private/empty; candidate bucket is absent and defined as private/10 MiB. The actual global upload limit is not exposed; owner must verify it is at least 10 MiB.                                                                     |
| Edge configuration                  | **PARTIAL**                      | `activity-submit` is not deployed. Required custom secret names exist; exact origin allowlist and upload-gate values are unverified. The old deployment helper targets only `notebook-submit`.                                                        |
| Synthetic browser-to-Edge E2E       | **BLOCKED**                      | Current free host RAM is 1.45 GiB, below the 2 GiB minimum. Wait until the gate is met; use a separate local project/ports and synthetic data.                                                                                                        |
| Recovery suitability                | **PASS WITH POLICY DECISION**    | Owner-reported restore, portable recovery, integrity and independent readback passed; metadata matches size/date. Proposed 72-hour additive-change cutoff is not an approved existing policy; refresh metadata and drift before any production write. |
| Production migration/deployment     | **NO-GO / NOT AUTHORIZED**       | Candidate remains unpublished. No migration, bucket creation, role change, Edge/Pages deployment, workflow activation, or production configuration update occurred in this follow-up.                                                                 |

### Shortest safe activation sequence

1. Owner verifies, without sharing values, that the project global Storage cap is at least 10 MiB and that the allowed-origin configuration exactly includes the production Pages origin; verify the upload gate's intended fail-closed state.
2. Resolve the `cli_login_postgres` risk through provider-backed authentication/lifecycle confirmation or a separately authorized `NOLOGIN` mitigation with post-change verification. Recheck the 22-entry migration history and exact single pending hash immediately before any migration.
3. Free host RAM to at least 2 GiB and run the synthetic browser-to-Edge/local review/grading E2E in a new isolated local stack. Preserve all existing containers and use only synthetic identities/files.
4. Approve the proposed recovery-age policy or supply the existing approved threshold. Immediately before the write, confirm the existing encrypted/offsite package remains within that threshold and repeat focused read-only migration, schema/security, Auth, and Storage drift checks. Do not create another backup unless this gate fails and a new cycle is separately authorized.
5. Separately authorize publication/merge of the reviewed candidate; regenerate or verify the configured Pages artifact against the final merged source tree.
6. Under separate production authorization, apply only `20261122120000_dynamic_activity_submissions.sql` from the protected 22-source CLI workspace; verify migration history, RLS/grants, private bucket and limits. Deploy only `activity-submit` after confirming its exact runtime configuration, initially leaving upload disabled until the production feature gate is explicitly authorized.
7. Separately authorize the Pages Direct Upload and any upload-gate enablement. Perform non-destructive live verification, then retain additive schema and academic records if rollback is needed; roll back the UI/function release or close the feature gate rather than dropping the bucket or deleting submissions.

**Final decision: NO-GO for production activation today.** The release candidate's configured local validation is complete by owner report, but the current RAM gate prevents synthetic E2E, the project Storage limit and runtime Edge values remain unverified, the privileged temporary CLI role lacks a complete authentication/lifecycle assurance, and the candidate has not been published or merged. Resolve those items and obtain the separate production authorizations above; do not repeat the completed recovery cycle or release validation without a concrete change.

## Autonomous final release completion update (2026-11-22)

This update supersedes the prior E2E note that said none of the synthetic local flow had run. It records only the additional work completed in the existing isolated candidate and the read-only provider checks available in this session.

### Scoring defect found and corrected

- The real local Edge/API grading flow exposed a cross-week accounting defect: when a Team reviewer published a Week 1 grade during Week 2, the canonical rubric award remained attributed to Week 1 (`point_awards.scoring_week`), but the file/notebook time bonus was counted in the publication week. That could make the bonus appear in Week 2 without its base grade award.
- The candidate migration now carries `submission_id` through the private scored-grade result and includes a file/notebook bonus in a weekly leaderboard period only when the corresponding canonical grade award for that same submission is attributed to that period. All-time totals are unchanged. The check uses `EXISTS`, so it cannot multiply bonuses through duplicate award rows.
- Regression coverage includes delayed file and notebook grading across a week boundary, all-time totals, current-week totals, and rank/own-row privacy. The updated migration SHA-256 is `fe7f0f5d75d76d35f1ac85431bd7d9260d0863af8aa859f8adac17c3967195e`; the test SHA-256 is `e3edd0c2b76475705d1581f33aa3f2a4e3668abf8b81a8529555e6f8c98ad28e`. Both are recorded in the exact-path approval manifest.
- The focused PGlite security suites passed **11/11**: `node --test tests/activity-leaderboard.security.test.mjs tests/activity-submissions.security.test.mjs`.

### Isolated local runtime verification

- Docker Desktop was available (engine 29.9.2; reported Linux-engine memory 5.48 GiB). The six required containers for the already-running task-owned project `ianalyze-phase2-e2e-1122` were running and labeled consistently. No containers were started, stopped, restarted, or reconfigured. C: had **83.75 GiB** free.
- Host free RAM recovered to **2.41 GiB / 11.38 GiB** after API checks, but fell to **2.17 GiB** after starting the local Vite server and **1.92 GiB** after starting an isolated headless Chrome profile. Chrome was stopped before navigating to the app; the Vite server was also stopped. The browser QA harness did not run and made no app or production requests. Free RAM was **1.98 GiB** immediately after stopping those processes and recovered to **2.33 GiB** at the final check. The earlier API continuation used only the existing loopback-only local stack at `127.0.0.1` and synthetic identities.
- The local continuation passed **21/21** checks: loopback isolation, synthetic Student/Team login, archived activity visibility, retention and review access for the published submission, student feedback visibility, attributed archive audit, all-time/weekly leaderboard behavior after archive, unused draft deletion, and final synthetic inventory (3 synthetic users, 1 submission, 1 published grade, 1 private object). It did not contact production or Google Drive.
- The first continuation stopped at an outdated test expectation that a published submission remains `submitted`. The existing grade-publication trigger correctly changes it to `reviewed`; a read-only local query confirmed the row was retained as `reviewed` and the activity was archived. No product-code or tracked-test change was needed for this assertion. The continuation then checked the intended `reviewed` state and passed.
- Earlier local Edge/API execution had already exercised upload reservation, private Storage upload, verification/finalization, Team review, grading, and feedback; the cross-week leaderboard assertion was its failing endpoint and is now covered by the new migration regression test and the 21-check continuation. A full browser-to-Edge UI pass, mobile layout, and bilingual visual review were not performed in this session.

### Refreshed hosted evidence and unresolved configuration

- Read-only project inspection again identified project `ocihwiqtgqplwgyhpwjv` as active/healthy on PostgreSQL 17.11. Migration history remains at **22**; the single candidate migration is still unapplied. No production SQL write, migration, Storage change, or function deployment occurred.
- The current bucket inventory remains: private `student-submissions` (20 MiB, 0 objects) and private `team-materials` (1 MiB, 0 objects). The migration-defined `activity-submissions` bucket is not present until the migration is authorized and applied. The Management/Data API does not expose the effective project-wide upload cap in the available read-only interface. Supabase documents a maximum of 50 MB on Free projects, but this does not establish the configured project value; owner Dashboard confirmation that the cap is at least 10 MiB is still required ([Supabase Storage file limits](https://supabase.com/docs/guides/storage/uploads/file-limits)).
- `notebook-submit` remains the only deployed function (active v17); `activity-submit` is not deployed. Read-only secret-name inventory confirms `ACADEMY_ALLOWED_ORIGINS` and `ACADEMY_UPLOADS_ENABLED` exist, but their values and effective CORS/preflight behavior are not observable without disclosing them. The browser-origin allowlist must include the production Pages origin, and the upload gate must remain fail-closed until approved ([Supabase Edge Function CORS](https://supabase.com/docs/guides/functions/cors)).
- Existing owner-authorized dashboard evidence says only `public` and `graphql_public` are Data API exposed and `app_private` is not exposed. This remains consistent with the current private-table design. The Free-plan leaked-password-protection limitation remains an accepted platform limitation; existing confirmation, password-change, 12-character minimum, rate-limit, and TOTP availability settings have not been changed. TOTP availability alone does not prove every Admin user is enrolled or has AAL2.

### Recovery, migration lineage, and temporary CLI role

- Read-only metadata in the exact approved Drive folder still lists the encrypted package `week1-predeploy-20261121T132358Z-UPLOAD-SAFE.zip`, **1,280,963 bytes**, created **2026-11-21 13:40:41 UTC**. At the latest metadata check (2026-11-22 13:26 UTC), its age was about **23 hours 46 minutes**. The owner previously reported SHA-256 readback, isolated restore, and portable recovery PASS; this turn did not download, rehash, or restore the package.
- No formally approved numeric freshness cutoff was found. The earlier **72-hour additive-migration** value remains a proposal only; it may be relied on only after owner approval or discovery of the project's existing approved policy. The existing recovery point is not a blocker for ordinary code review. No new backup is requested here.
- The old protected CLI workspace and its exact-one dry run refer to the previous candidate migration hash. Because the migration was corrected in this review, that old dry-run evidence no longer proves the current migration contents. Before any production migration, the protected CLI workspace must be refreshed with the current manifest-pinned migration, the 22 historical sources reverified, and a new exact-one dry run reviewed. Do not perform that remote dry run until the owner resolves the known CLI-role side effect.
- `cli_login_postgres` remains a real production security uncertainty from the earlier dry-run: `LOGIN` is enabled, password validity expired, no active sessions or owned objects were observed, and membership allows `SET ROLE postgres`. Password expiry does not prove that all authentication methods are unusable. No provider confirmation or role change was made. The owner must obtain provider-backed confirmation that it cannot authenticate and is safely transient, or separately authorize the exact mitigation `ALTER ROLE cli_login_postgres NOLOGIN` after rechecking project, role state, zero sessions, and dependencies; verify `rolcanlogin=false` and unchanged migration history afterward. If CLI can recreate it, check its state again after authorized migration execution.

### Final activation matrix

| Area                                    | Status                                             | Current evidence / remaining gate                                                                                                                                                                                                  |
| --------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate scoring and activity security | **PASS, focused**                                  | Week-attribution defect fixed; 11/11 PGlite leaderboard/submission security tests and 21/21 local API continuation checks passed.                                                                                                  |
| Existing configured release validation  | **PASS (owner-reported, earlier candidate state)** | 127 frontend / 73 DB-security tests, type/lint/format/preservation, configured build, and 70-file artifact passed before the latest SQL/test correction. Not repeated.                                                             |
| Browser and visual E2E                  | **BLOCKED**                                        | At the observed setup, Vite plus isolated Chrome reduced free RAM below 2 GiB (1.92 GiB); the harness was stopped before app navigation. API/Edge tests ran locally; browser/mobile/Arabic-English visual pass remains unverified. |
| Hosted Storage capacity                 | **UNVERIFIED**                                     | Bucket privacy/object counts are verified; actual project-wide limit must be confirmed in Dashboard as at least 10 MiB.                                                                                                            |
| Hosted Edge readiness                   | **PARTIAL**                                        | Candidate function is not deployed. Required secret names exist; origin allowlist and upload-gate values remain unverified.                                                                                                        |
| Migration dry-run                       | **STALE FOR CURRENT HASH**                         | Remote history remains 22, but prior dry-run used the superseded candidate migration hash. Refresh and verify before production use.                                                                                               |
| Recovery point                          | **OWNER-REPORTED PASS; POLICY PENDING**            | Package metadata is current and matches the reported size; restore/readback evidence is historical owner report. Approve the proposed 72-hour additive threshold or provide the existing policy.                                   |
| CLI role security                       | **BLOCKED**                                        | `cli_login_postgres` can LOGIN and may SET ROLE postgres; password expiry alone is insufficient assurance. Provider-backed disposition or separately authorized NOLOGIN mitigation is required.                                    |
| Production activation                   | **NO-GO / NOT AUTHORIZED**                         | No migration, bucket/function/Pages deployment, role/configuration change, or workflow activation occurred.                                                                                                                        |

### Minimum remaining owner actions and release order

1. In the Supabase Dashboard, verify the effective global Storage upload limit is at least 10 MiB; check the exact `activity-submit` origin allowlist and upload gate without sharing secret values. Maintain the upload gate closed until the function is deployed and verified.
2. Resolve `cli_login_postgres` by provider-backed authentication/lifecycle evidence or separately authorize the narrow `NOLOGIN` SQL and post-check. Then refresh the protected migration workspace against the current migration SHA and conduct an explicitly reviewed exact-one remote dry run.
3. Approve the repository's recovery freshness threshold (or locate its existing policy), then perform focused read-only drift and recovery metadata checks immediately before any production write. Do not create a backup for ordinary code changes.
4. If desired, free enough host RAM to keep at least 2 GiB available after starting the local Vite server and isolated Chrome; this run consumed about 0.5 GiB for both. Then run the existing browser harness against the local app. This is a confidence gap, not a discovered data or authorization defect.
5. Separately authorize publication/merge, apply only the one current reviewed migration, verify migration history/RLS/grants/private bucket/scoring, deploy `activity-submit` with the closed upload gate, verify CORS/auth/file limits, and only then separately authorize Pages deployment and any gate opening. No stage is authorized by this readiness report.

**Final decision: NO-GO for production activation.** Candidate-local security and local API/Edge verification are complete for the covered flows, and the scoring defect is fixed. Production activation still requires the hosted Storage/Edge checks, resolution of the temporary CLI login role uncertainty, a fresh dry run for the updated migration hash, and an approved recovery-freshness policy. Browser visual verification remains incomplete. The previous successful configured release result is owner-reported and predates the latest SQL/test-only adjustment.

## Autonomous final release closeout (2026-11-22 UTC)

### Candidate-local validation

- `npm.cmd test`: **127/127 passed**.
- `npm.cmd run test:database:embedded`: **73/73 passed**.
- Focused PGlite leaderboard/submission security tests: **11/11 passed**.
- TypeScript, ESLint, Prettier, database type integrity, production boundary check, Phase 02 integrity, Phase 03 boundary, redesign integrity, and preservation checks: **PASS**. Preservation reports **405 inherited files** and **209 exact hash-pinned resolutions**.
- `git diff --check`: **PASS**. No migration, production role, deployment, workflow, account, or Drive operation occurred.

### Lightweight browser verification

- The existing isolated headless-browser approach ran without stopping or reconfiguring unrelated processes or containers. The responsive route/layout matrix completed **160 cases with 20 screenshots**; the focused Week 1, authentication-gate, Team-route, locale, and lazy-video checks passed **12/12**. The checks used a local-only static server and blocked third-party requests.
- The existing synthetic local Edge/API continuation remains **21/21 passed**, including private file upload/finalization, Team review, grading/feedback, archive behavior, and leaderboard attribution. The focused PGlite suite also passed above.
- These are separate browser and real local Edge/API validations. A single authenticated browser-driven file-upload-through-review journey was not executed; do not describe that combined flow as E2E-verified. Video playback itself was not tested.

### Configured Pages artifact

- The preserved artifact has **70 files / 6,550,560 bytes**. A read-only comparison matched all **70/70** files to `artifacts/pages-artifact-manifest.json`. `artifacts/configured-build.json` identifies the authorized project and gates `registration=true`, `submissions=true`, `leaderboard=true`, `privacyApproved=true`, `developmentPreviews=false`.
- Artifact metadata was generated at **2026-11-22 11:39:40 UTC**; the newest frontend source-file modification timestamp is **2026-11-22 09:30:35 UTC**. This review changed the browser QA harness/manifests/documentation and database tests/migration, not bundled frontend source.
- The owner-reported configured release:check remains reusable for unchanged frontend build inputs. A fresh registration proof is time-limited and must be generated in the owner process immediately before any later configured release check. The configured artifact checker was invoked but stopped at preflight because the approved VITE_SUPABASE_URL and publishable key are not present in this process; it did not modify the artifact. The public-only Pages checker was run against this configured artifact and correctly rejected its two backend-key occurrences because that mode expects a public-only artifact. The configured artifact itself was checked against its saved file manifest and gate metadata without reading key contents.

### Current hosted checks and migration boundary

- The authorized Supabase project remains active/healthy on PostgreSQL 17.11 with **22 applied migration records**. The only pending migration is `20261122120000_dynamic_activity_submissions.sql`, SHA-256 `fe7f0f5d75d76d35f1ac85431bd7d9260d0863af8aa859f8adac17c3967195e`. The protected temporary CLI workspace contains the 22 fetched historical migrations plus this exact candidate migration; the current candidate and workspace copies match the approved hash. No fresh remote dry run was performed for this corrected hash.
- Existing private buckets remain empty; the new private `activity-submissions` bucket is absent until its migration is applied. The project-wide Storage upload cap (must be at least 10 MiB) and the effective `ACADEMY_ALLOWED_ORIGINS` / `ACADEMY_UPLOADS_ENABLED` values remain unverified. Secret names are present; values were not read.
- The production role `cli_login_postgres` still has `LOGIN` and `SET ROLE postgres` membership. Its password validity has expired, and read-only checks found zero active sessions and zero owned relations; password expiry alone does not prove that every authentication method is disabled. No role change was made. Do not repeat the CLI dry run until the role is resolved; the prior dry run created this role.

### Recovery evidence and decision

- Reused the owner-reported encrypted backup, isolated restore, portable decryption, checksum, and independent Drive readback PASS. Drive metadata identifies the same **1,280,963-byte** encrypted package created **2026-11-21 13:40:41 UTC**; at this review it is about **24 hours 44 minutes old**. No new backup or download was performed. No approved numeric freshness cutoff was found; **72 hours** remains a proposed policy value, not an accepted policy.
- **Production activation remains NO-GO.** The candidate-local security/test gates pass, but the combined browser-to-Edge UI journey, configured checker in this process, hosted Storage cap/Edge values, safe disposition of the temporary CLI login role, and an approved recovery freshness threshold remain unresolved. The single pending migration was not applied, and no role, feature gate, function, Pages deployment, or production setting was changed.

### Minimum follow-up order

1. In the owner's PowerShell, from this candidate's `frontend` directory, run `& '.\\scripts\\run-configured-release-check.ps1'` for fresh registration proof and configured artifact validation. The script reuses approved process values and masks prompts for missing private inputs.
2. In Supabase Dashboard, confirm Storage's effective global file-size limit is at least **10 MiB**; privately verify the `activity-submit` origin allowlist and keep `ACADEMY_UPLOADS_ENABLED` closed until the function is deployed and checked.
3. Before any migration, recheck `cli_login_postgres` sessions/dependencies and separately approve either provider-backed confirmation that it cannot authenticate or the exact narrow mitigation `ALTER ROLE cli_login_postgres NOLOGIN`. Approve a numeric recovery-age policy (72 hours is only a proposal); then refresh the protected workspace and obtain a new exact-one dry run for the pinned migration hash.

Only after these gates pass should the owner separately authorize publication, the one additive migration, Edge deployment with uploads closed, and Pages deployment. Do not request a new backup for routine code review.

## Final isolated E2E and production preflight — 2026-11-22

This section supersedes earlier Phase 2 validation, migration-hash, recovery-age, and browser-E2E status above where they differ. Production checks below were read-only. No migration, upload, role, configuration, or deployment change was made.

### Candidate and validation identity

- GitHub `main` and local `HEAD` are both `be870c7d087d10d32d0a776cc6352d32e661387b`. The release branch `release/phase2-consolidated-20261122` remains uncommitted and has **40 changed paths**: 38 paths pinned by `docs/phase-05/approved-consolidated-features.json`, that approval manifest, and the separate `docs/final-quality/approved-changes.json` preservation record. All 38 pinned file hashes match their current contents; no other application path is outside that set.
- The owner reports the latest configured `release:check` PASS: frontend **129/129**, embedded database/security **73/73**, TypeScript, ESLint, formatting, database types, preservation, fresh registration proof, and configured Pages artifact checks PASS. The owner also reports the complete isolated authenticated Student-to-Edge-to-Team-review/grading/leaderboard E2E PASS. The separate local E2E run in the new stack passed the closed-by-default and independent activity-upload-gate cases and removed all synthetic records and bucket objects. The new stack was stopped; the pre-existing E2E stack was left running.
- The present configured artifact contains **70 files / 6,550,602 bytes**. Every file matches `frontend/artifacts/pages-artifact-manifest.json`; that manifest SHA-256 is `769c97e5a21637c53ff83dacba0c8c27b65c1c2b576adb3ef875b75e94d42bdd`. Build metadata records project `ocihwiqtgqplwgyhpwjv` and registration/submissions/leaderboard/privacy approvals true with development previews false. The artifact manifest records file integrity and gate metadata, not a source commit. Rebuild and verify an artifact from the exact merged `main` commit before deployment.
- The reviewed migration `20261122120000_dynamic_activity_submissions.sql` is currently SHA-256 `851979d7cb84b3bf618bcf8eeb4d55c9a2279fdf28178089ef32273aeb50ae21`; its Edge entry file is `5c2000c5b1cefec2fa2353876230df26d0b1a3af7b9fc23e07b90b23bd618e21`. Both match the current Phase 05 exact-path approval manifest. These supersede the previously recorded `fe7f...` migration hash.

### Current read-only production snapshot

- GitHub `main` still matches the candidate base above. Supabase project `ocihwiqtgqplwgyhpwjv` is active and healthy. Production migration history remains at **22**; `20261122120000_dynamic_activity_submissions` is absent and is the sole candidate migration.
- The existing `public.academy_capabilities()` is stable, security-invoker SQL and currently returns submissions=true and leaderboard=true. `public.academy_leaderboard` retains only the `p_weekly boolean` signature. RLS is enabled on `profiles`, `activities`, `submissions`, and `grades`. The new activity-file relation and activity gate function are absent until the candidate migration is applied.
- Production Storage still has only the private, empty `student-submissions` (20 MiB) and `team-materials` (1 MiB) buckets. The new `activity-submissions` bucket is absent. The owner confirms the global limit is at least 10 MiB and the production origin allowlist is correct; those provider settings were not independently read through the available interface.
- `notebook-submit` remains the only deployed Edge Function (active v17). Production `ACADEMY_UPLOADS_ENABLED` and that existing path are untouched. The new `activity-submit` function is not deployed. In candidate code, it separately requires the database `activity_file_submissions` capability and `ACADEMY_ACTIVITY_UPLOADS_ENABLED === 'true'`; the migration defines the database gate as immutable `false`. Thus the new path remains closed independently of the existing Week 1 notebook gate. Later enabling it requires a separately reviewed database change as well as explicit Edge-gate approval; changing the Edge secret alone cannot open the database gate.
- The temporary production CLI role is present with `rolcanlogin=false`.

### Recovery and activation gates

- The owner-approved recovery age for this release is **72 hours**. The owner-reported encrypted package is `week1-predeploy-20261121T132358Z-UPLOAD-SAFE.zip`, 1,280,963 bytes, SHA-256 `60978D0121D1CCA50CAFE0635DCCBC989C4ED4FEFB1C7D97103982EC9121E358`, created `2026-11-21T13:40:41Z`. At this snapshot (`2026-11-22T18:36Z`) it is about **25.9 hours** old. The owner reports isolated restore, portable recovery, checksum, and independent Drive readback PASS. No new backup was made. Immediately before the migration, recheck package integrity, the 72-hour threshold, and full risk-based production drift; obtain a fresh backup only if that gate fails and the owner separately authorizes it.
- The previous remote CLI dry run used the superseded `fe7f...` migration content. No exact-one dry run exists for the current `851979...` hash. Before applying it, refresh the protected workspace with the 22 verified historical sources plus only this hash-pinned migration, verify the project and exact-one dry-run output, and confirm the CLI role remains NOLOGIN. No migration is authorized by this readiness update.
- The current Pages helper targets the existing `ianalyze-academy` Direct Upload project and `main`, but its deployment path requires a GitHub Actions push context. The owner has reported the production workflow disabled. Do not enable it or bypass its guard; before Pages deployment, obtain separate approval for a reviewed owner-controlled Direct Upload route that verifies the merged commit and artifact, or for another explicitly approved route.
- Safe order: publish the exact candidate for PR review; review CI and the 40-path diff; merge only after approval; rebuild the configured artifact from the resulting `main` commit; refresh recovery/drift and the exact-one migration dry run; separately authorize and apply the single migration; verify RLS/grants, the private 10 MiB bucket, and unchanged existing gates; verify production CORS and keep the new Edge gate absent/false; separately authorize and deploy `activity-submit`; run read-only authentication/CORS/gate smoke checks; separately authorize the Pages Direct Upload and verify the live commit/artifact; keep new activity uploads closed until a later reviewed database-gate change is authorized.

**Current decision:** candidate-local code and recovery checks support proceeding to staged PR review. Production migration and deployment are **not ready to execute yet**: the current-hash protected CLI dry run and an approved Pages deployment route are outstanding. The new activity-file feature is deliberately not active in production.

## PR #24 service-role ACL and Edge deployment correction — 2026-11-22

This follow-up supersedes the prior PR #24 migration and Edge deployment fingerprints above. Candidate-only files changed; no production connection, migration, role, secret, Edge deployment, Pages deployment, workflow activation, commit, or push occurred.

- The migration now grants `EXECUTE` on `app_private.finalize_activity_submission(uuid,jsonb)` and `app_private.cancel_activity_submission(uuid)` only to `service_role`, after the existing revokes. The public `SECURITY INVOKER` wrappers remain service-role-only; `PUBLIC`, `anon`, and `authenticated` remain denied on the private functions. The isolated database test checks the effective ACL for all three roles and exercises successful service-role finalization and cancellation, while preserving student-denial and content-verification checks.
- The Edge deploy helper now sets only the production origin and `ACADEMY_ACTIVITY_UPLOADS_ENABLED=false`; it no longer writes `ACADEMY_UPLOADS_ENABLED`, which remains the independent Week 1 notebook gate. When the reviewed Edge release step runs, it deploys both `notebook-submit` and `activity-submit`, verifies both are active with gateway JWT verification disabled as required by their in-function `auth.getUser` checks, and requires both functions to reject an invalid bearer token. Activity uploads remain closed by the database's immutable-false capability and the explicit false Edge flag. The production workflow definition and triggers were not changed or enabled.
- Updated SHA-256: `20261122120000_dynamic_activity_submissions.sql` — `769d9a502fa504639806bbd31ba899a1e379153930726bee080a8c75d4cb2a16`; `frontend/scripts/deploy-supabase-edge.mjs` — `6cc0f7819c9bde6e9923a55fdd163ef9958337d71957a104d28bf9cc0674c073`.
- Focused checks: `node --test tests/activity-management.test.ts` — **13/13 PASS**; `node --test tests/activity-submissions.security.test.mjs` — **9/9 PASS**.
- Full candidate validation: `npm.cmd run validate` — **PASS**; frontend **130/130**, embedded database/security **73/73**, TypeScript, ESLint, Prettier, production-boundary/artifact checks, Phase 02/03 checks, preservation, and database types passed. The validation rebuilt `frontend/dist` as a 66-file unconfigured public artifact and refreshed its artifact manifest. Do not deploy the current `dist`; the prior configured files are no longer the local build output. No configured production artifact or fresh registration proof was regenerated.
- Previous owner-reported authenticated E2E and configured artifact-integrity results remain historical evidence for the unchanged frontend journey and frontend build inputs. They do not verify the corrected service-role grants or revised deployment script. The corrected focused database test now exercises finalization/cancellation, but rerun the isolated browser-to-Edge E2E and the owner-controlled configured release check before production activation; rebuild the configured artifact from the final reviewed source. No production readiness is inferred from this local validation.
- Preservation: `npm.cmd run check:redesign` passed with **405 inherited files** and **209 exact hash-pinned resolutions** after recording the new script fingerprint and all changed candidate hashes. The candidate remains uncommitted; the original PR and production state are unchanged.

Production migration, Edge deployment, and Pages deployment remain separately gated. Before activation, refresh the protected migration workspace and exact-one dry run for the updated migration hash; recheck recovery freshness/drift and provider prerequisites; then authorize and execute each production-changing stage separately. Keep the activity upload gate closed until a later explicit activation review.
