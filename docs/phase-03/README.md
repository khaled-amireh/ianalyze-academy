# Phase 03 — local Supabase foundation

This branch implements infrastructure for the existing academy. Hosted application,
deployment, public registration, and production uploads are not authorized by this phase's
implementation approval. No hosted project has been linked or changed.

## Confirmed owner decisions and inventory

- Reuse `ianalyze-academy`, reference `ocihwiqtgqplwgyhpwjv`, Free, West EU (Ireland).
- Owner inspection: no public tables; only built-in schemas visible; no migrations shown;
  no file buckets. Direct `COUNT(*) FROM auth.users` returned **0**; the dashboard's
  contradictory estimated footer was not used as evidence.
- Email provider, new signups and email confirmation are on. Google, Phone, Anonymous,
  manual linking and other visible providers are off. Custom SMTP is off and unchanged.
- Accept personal and university email addresses; there is no domain allowlist.
- Two application roles only: Student and Team. Leaders and Organizers have equal Team
  permissions. Registration requires no leader approval.
- Student notebooks: `.ipynb` only, provisional 262,144-byte limit. Uploads remain blocked.
- Preserve the frontend, archives, tests, original supplied portraits, and Yomna guides.

## What is implemented

- Pinned SDK/CLI, typed client and database types derived from the local migration catalog.
- Session restoration with server-verified identity and database-backed role lookup;
  logout, lifecycle/race protection, generic errors and optional presentation guards.
- Ten application tables, RLS/grants, default Student bootstrap, server-managed email and
  profile timestamps, controlled registration completion and audited role changes.
- Versioned rubrics, atomic grade revisions, rubric bounds, publication checks and
  optimistic concurrency. No grading dashboard or leaderboard calculations.
- Two private buckets, ownership/reservation policies, no client overwrite/delete policy,
  and a database-level upload gate hardcoded to false.
- Embedded PostgreSQL security tests, full local Supabase integration tests and pgTAP
  checks. Their execution status is recorded separately in [validation.md](validation.md).

## Frontend and collaboration boundary

All public routes, styling, locales, RTL/LTR, themes, content, social links, video resource
and portraits are preserved. `/team` is still the public Leaders page. The Join page is
still disabled; its existing university-email label will need to reflect the broader
eligibility policy when Phase 04 implements the registration experience.

Only `main.tsx` receives the transparent AuthProvider. Missing/invalid configuration
causes no authentication requests and denies protected capabilities. No protected dashboard
or public authentication journey is activated. PKCE callback processing is intentionally
deferred to Phase 04 (`detectSessionInUrl: false`).

The original Phase 00 role/approval plans are historical: this document supersedes their
separate Leader/Organizer roles and registration-approval queue without editing archives.
The exact owner-supplied `docs/yomna/` files remain unchanged; no Yomna branch is created
or modified. New backend work stays on `codex/phase-03-supabase`.

## Read next

- [Database and authorization](schema-security.md)
- [Local setup and future owner actions](setup.md)
- [Executed checks and limitations](validation.md)

Reference guidance: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Storage](https://supabase.com/docs/guides/storage/security/access-control),
[API keys](https://supabase.com/docs/guides/getting-started/api-keys).
