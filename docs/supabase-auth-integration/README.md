> Latest audit: [bilingual content and registration handoff](BILINGUAL-AUDIT.md). Save now confirms persistence, retains the existing session, and opens the role-appropriate dashboard.

> Current registration/owner status: [REGISTRATION-HANDOFF.md](REGISTRATION-HANDOFF.md) supersedes the earlier closed-registration release status below. The verified owner has Team access; registration is approved for the next push, with a read-only owner/role checkpoint. The live website is unchanged until that push.

Production readiness verified on 2026-11-02. The approved database and Auth changes are complete for `ocihwiqtgqplwgyhpwjv`. The frontend and notebook Edge Function have **not** been deployed; the prepared GitHub Actions workflow will release them after the owner's push. Registration, submissions, leaderboard and privacy launch gates remain closed. Hosted registration/login and SMTP delivery have not been tested. See [current report](REPORT.md), [production execution](PRODUCTION-EXECUTION.md), [backup rehearsal](BACKUP-REHEARSAL.md), and [reviewed source/dependency hashes](approved-changes.json).

The working branch is `codex/supabase-auth-integration`, based on main after PR #4 (`5baffef`). No push, merge or manual frontend/Edge deployment was performed.

**Try registration locally now.** Docker, the project-scoped Supabase services, the local Edge Function and the existing development server were running at completion of testing. Open <http://127.0.0.1:5173/join>. Create a local test account with a password of at least 12 characters. Open captured mail at <http://127.0.0.1:54324> in the same browser profile, follow its confirmation link, and complete the student profile. Then test logout/login and refresh. No external SMTP email is sent by the local stack.

There is no manual student approval queue: the Auth trigger creates a profile and Student role, then verified email and completed profile/consent unlock registered capabilities. Leaders and Organizers share the existing `team` authorization level. Assign Team rights only through the controlled owner procedure in [schema-security.md](../phase-03/schema-security.md), using the actual verified Auth UUID; user metadata cannot grant roles.

The database is empty after fixture cleanup. Activities, grades and leaderboards therefore begin with their intentional empty states. Submission and leaderboard database gates are closed after testing. Test scripts open and restore local gates only; do not enable the legacy direct-upload gate.

**Repeat the local workflow.** Run these from the repository root in PowerShell. A fresh/disposable local test database is required before fixture suites. Preserve manual local accounts/data before resetting anything; these instructions do not reset a database or target a hosted project.

```powershell
$env:SUPABASE_TELEMETRY_DISABLED = '1'

# If the project-scoped local stack is stopped, start it without displaying credentials.
.\frontend\node_modules\.bin\supabase.cmd start --workdir . *> $null
if ($LASTEXITCODE -ne 0) { throw 'Local Supabase startup failed; inspect sanitized diagnostics.' }
.\frontend\node_modules\.bin\supabase.cmd db push --local --skip-vault --workdir .
if ($LASTEXITCODE -ne 0) { throw 'Local migration failed; preserve the database and inspect before retrying.' }

# Writes ignored local test environments; does not overwrite existing .env files.
npm.cmd --prefix frontend run local:prepare
```

If the local Edge server is not already running, keep this in a separate terminal:

```powershell
$env:SUPABASE_TELEMETRY_DISABLED = '1'
$localEdgeEnvironment = (Resolve-Path 'frontend/artifacts/supabase-auth-integration/edge.env').Path
.\frontend\node_modules\.bin\supabase.cmd functions serve notebook-submit --env-file $localEdgeEnvironment --workdir .
```

The existing dev server already occupies port 5173. Use it. To restart later, stop that server first, then run:

```powershell
npm.cmd --prefix frontend run dev:local
```

`dev:local` loads only the prepared browser-safe local environment. Its registration, privacy, submission and leaderboard frontend flags are local test overrides. `build:public` ignores those files and always produces the closed, unconfigured public candidate.

Run checks in another terminal:

```powershell
npm.cmd --prefix frontend run validate
npm.cmd --prefix frontend run test:local
npm.cmd --prefix frontend run check:database-types:local
npm.cmd --prefix frontend run test:database:supabase
```

The first command uses the embedded migration fixture. The next command exercises real local Auth, captured email, PostgREST, Storage and Edge services. The live type command compares the same table, foreign-key and RPC catalog with the actual local PostgreSQL database. The last command executes pgTAP against local Supabase.

For the authenticated browser suite, start task-owned headless Chrome on debugging port 9237, with a separate profile under ignored `frontend/artifacts/`. Then, from `frontend`:

```powershell
node --env-file=artifacts/supabase-auth-integration/stack.env scripts/phase-04-browser-qa.mjs
```

The harness uses only loopback Supabase ports, synthetic `.test` accounts and UUID-scoped fixtures. It removes its own test users/records/files and restores closed gates. It is not a staging/production test tool. Never use hosted credentials in these local environment files.

**Required variable names.** Browser configuration uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, with `VITE_ENABLE_REGISTRATION`, `VITE_ENABLE_SUBMISSIONS`, `VITE_ENABLE_LEADERBOARD`, `VITE_PRIVACY_APPROVED`, and `VITE_ENABLE_DEV_PREVIEWS`. Real examples remain blank/false. Privileged keys must never have a `VITE_` prefix.

The ignored test runner uses `RUN_LOCAL_SUPABASE_TESTS`, `LOCAL_SUPABASE_URL`, `LOCAL_SUPABASE_DB_URL`, `LOCAL_SUPABASE_PUBLISHABLE_KEY` and `LOCAL_SUPABASE_SECRET_KEY`. The Edge runtime reads its server-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, plus `ACADEMY_ALLOWED_ORIGINS` and `ACADEMY_UPLOADS_ENABLED`. Do not print, paste into chat, or commit credential values.

**Push-triggered production release.** [.github/workflows/production.yml](../../.github/workflows/production.yml) runs only on pushes to `codex/supabase-auth-integration` or `main`. Both approved source branches publish to the existing Direct Upload Pages project's production label `main`; this does not merge or push Git's main branch. No database migrations run in CI. Source, authorization, preservation and artifact checks must pass before release. CI releases the notebook function with server-side identity verification and uploads closed, verifies anonymous rejection, publishes Pages, then verifies the canonical artifact and callback no-store headers.

GitHub Actions secrets (configured): `CLOUDFLARE_API_TOKEN`, `SUPABASE_ACCESS_TOKEN`. Repository variables (configured): `CLOUDFLARE_ACCOUNT_ID=f25401b10b1826c747cd11739a9410bc`, `CLOUDFLARE_PAGES_PROJECT=ianalyze-academy`, `CLOUDFLARE_PRODUCTION_BRANCH=main`, `SUPABASE_PROJECT_ID=ocihwiqtgqplwgyhpwjv`, `PRODUCTION_ORIGIN=https://ianalyze-academy.pages.dev`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Credential values are not documented or committed. Server secrets are available only to their deployment steps; builds receive browser-safe variables only. Cloudflare environment dashboard values are not a substitute for Vite build inputs in Direct Upload.

Push from the repository root:

```powershell
git switch codex/supabase-auth-integration
git push -u origin codex/supabase-auth-integration
```

Wait for [GitHub Actions](https://github.com/khaled-amireh/ianalyze-academy/actions) to pass, then open <https://ianalyze-academy.pages.dev>. Check Arabic/English, RTL/LTR, themes, mobile layouts, login/recovery navigation, and Student/Team route denial when signed out. No hosted test user exists. Registration and submissions remain intentionally closed, so a successful release does not authorize launch or permit an end-to-end hosted signup test. Launch activation, approved privacy content and verified Team UUID assignments remain separate owner decisions. The opaque Cloudflare Actions token cannot be read back; CI verifies its access before any release, and insufficient Pages Edit scope will stop deployment.
