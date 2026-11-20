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
