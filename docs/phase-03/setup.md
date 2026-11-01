# Local setup and owner actions

## Already available

The existing frontend/assets/docs are complete. Hosted URL/reference and public key
availability are confirmed. No confidential Team Syllabus, portraits or other source
uploads are needed. Personal and university emails are both accepted.

## Safe local development

From the repository root, on Windows:

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run validate
```

Validation includes the original checks, embedded PostgreSQL security suite, generated-type
drift check, dependency provenance, frontend preservation and source secret-pattern checks.
Embedded PGlite runs in memory and does not connect to Supabase.

Docker Desktop or another compatible runtime is required for the real local Supabase
stack. Install/start that runtime when ready. The pinned CLI is already a frontend dev
dependency; no global CLI installation or Supabase login is needed for local work.

```powershell
$env:SUPABASE_TELEMETRY_DISABLED = '1'
.\frontend\node_modules\.bin\supabase.cmd start --workdir .
```

This starts the local stack and applies local migrations. It does not link or alter the
hosted project. Local Studio uses port 54323; captured test mail uses 54324. No external
SMTP credentials or real mail delivery are required. Use only synthetic `.test` accounts.
Treat this stack as disposable. Never run database reset commands against a hosted project.

Run `npm.cmd --prefix frontend run test:database:supabase` for the pgTAP checks. The
script explicitly uses `--local`. Do not pass a hosted `--db-url` or `--linked` flag.
Its 12 assertions remain unexecuted until the real local stack is available.

For Auth/REST/Storage integration, copy `supabase/.env.example` to ignored
`supabase/.env.local` and populate values from **local** CLI status. Keep the local DB
password/secret key in that ignored file; never paste or commit them.

```powershell
Set-Location frontend
node --env-file=../supabase/.env.local --test tests/supabase.integration.test.mjs
```

The file explicitly opts in with `RUN_LOCAL_SUPABASE_TESTS=1`. The harness rejects
non-loopback hosts, unexpected ports, API credentials in URLs, and URL query injection
before opening connections. It requires an initialized, fresh local academy schema.
It creates synthetic users/files and removes only its own UUID-scoped test fixtures.
Fixture teardown temporarily disables immutability triggers in one local transaction;
this is not an application capability or a production cleanup procedure.

Without opt-in, `npm.cmd --prefix frontend run test:integration` reports the suite skipped,
with **zero integration tests executed**. A skipped suite is not a security pass.

## Frontend configuration

Copy `frontend/.env.example` to ignored `frontend/.env.local` when intentionally connecting
to the local stack. Populate `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` with
local values. The hosted public values can be used only at a later approved connection
stage. Secret/service-role keys must never use a `VITE_` variable or enter browser code.

No configuration is required to view the public site; missing/invalid values disable the
authentication capability. A present session is verified with Auth `getUser()` and a
database role RPC before protected presentation is allowed. Logout revokes the current
session's refresh capability through the SDK; access JWTs can remain valid until expiry.
Network failure is reported and protected presentation stays denied; server revocation
cannot be claimed when the request fails.

`npm.cmd --prefix frontend run db:types` regenerates types from migration metadata using
the embedded PostgreSQL fixture, including public foreign-key relationships. It is not
hosted CLI type generation. Before hosted activation, compare with actual local Supabase
CLI-generated types and managed Auth/Storage behavior.

## Owner actions that remain

1. Make a Docker-compatible runtime available, then run/review real local Supabase and
   pgTAP results. Backend verification is incomplete until these execute successfully.
2. Review this branch/PR. Before any hosted application, separately approve the exact
   migrations and inspect current hosted tables, functions, triggers, grants, policies,
   existing Auth accounts, migration history and PostgreSQL version. Local defaults use
   PostgreSQL 17; the hosted version has not been checked. Do not overwrite existing work.
3. Provide privileged access only through owner-authenticated CLI/Dashboard or a secure
   secret store when hosted work is authorized. No real privileged credential is needed
   in chat, source control or frontend environment variables.
4. Before Phase 04 launch: approve the privacy notice/version, sender identity and SMTP
   provider, exact production/callback URLs, abuse protection and Team MFA approach.
   Configure initial Team accounts by verified UUID through the controlled owner procedure.
5. Before activating uploads: approve retention/attempt quotas, implement trusted notebook
   validation/finalization and orphan reporting, and explicitly review a migration opening
   the upload gate. Reviewed work must not be automatically deleted.

SMTP remains **off**. Supabase's built-in sender is intended for tests and currently limits
recipients to project-team addresses and two messages/hour. Prefer an existing authorized
university/academy mail service or a reviewed free-quota provider before student launch.
Google OAuth, Phone/SMS and Anonymous auth remain deferred.
[SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp)

No hosted migration, settings push, deployment or main-branch push is part of this local
delivery. The PR must be reviewed; it must not be merged automatically.
