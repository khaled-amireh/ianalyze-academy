# Final improvements — local release candidate

Approved scope: state-aware navigation, private profile management, conditional Al-Zaytoonah University ID, localized major choices, in-app notifications, Remember Me, privacy wording, public syllabus hiding, and three original team portraits. No dependencies were added. Google Drive playback and private Team materials retain their integration.

## Database and release gate

`supabase/migrations/20261104000100_profiles_notifications.sql` is **not applied to hosted Supabase**. It adds a nullable university column, an Al-Zaytoonah-only unique ID index, forward validation, activity publication timestamps, announcements, private read receipts, and role-checked notification RPCs. Existing UUIDs, roles, private data and historical university/major values are retained. Unknown historical universities are not guessed or backfilled. ID uniqueness applies when a profile explicitly selects Al-Zaytoonah.

The notification feed rechecks publication status, verified registration and ownership each time it is read. Draft announcements, draft grades, other students' submissions and Team materials are excluded. Deadlines appear within three days while a relevant submission remains outstanding. Read receipts persist on the server. The client refreshes on navigation/focus, after read actions, and every minute while visible; no push or notification email service is used.

Before release:

1. Restore the local Docker/Supabase runtime and complete the real Auth/PostgREST integration tests against disposable local data. Embedded PostgreSQL and fixture browser checks do not replace GoTrue integration tests.
2. Create a fresh private hosted backup, including Auth, application schemas, relationships and storage inventory/content as applicable. Verify checksums and an isolated restore. The older backup is not a fresh release checkpoint.
3. Review hosted migration history, current policies, grants and the additive SQL. The existing frontend cannot supply university during registration after the new server validation is applied, so coordinate a brief registration maintenance window with the release. Preserve Auth verification settings and existing sessions; do not change roles or delete accounts.
4. Apply only the reviewed additive migration with a checked recovery plan. Run `supabase/operations/final-improvements-readiness.sql` and verify profile updates, duplicate-ID rejection and two-account notification isolation. No production mutation was performed by this task.
5. Run the complete release checks and read-only owner/schema gates. Only then push the requested branch; its GitHub workflow automatically deploys production. CI checks the new schema before deployment and does not run migrations. Do not merge or force-push.

## Verification and private audit

`npm test` covers the actual Supabase SDK session adapter, validation, authentication boundaries, bilingual catalogues and logo hashes. `npm run test:database:embedded` includes the new university and notification RLS tests. `npm run validate` runs the existing source/build/security checks.

The focused browser test uses intercepted localhost fixture responses. Start Vite at `http://127.0.0.1:5187` with `VITE_SUPABASE_URL=http://127.0.0.1:54321`, `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_LOCAL_UI_FIXTURE`, `VITE_ENABLE_REGISTRATION=true`, `VITE_PRIVACY_APPROVED=true`, and development previews disabled. Run `node scripts/final-improvements-browser-qa.mjs` from `frontend`. It creates a dedicated headless Chrome profile and saves small, ignored evidence under `frontend/artifacts/final-improvements/`.

The hosted account review is stored only in ignored `frontend/artifacts/final-improvements/PRIVATE-account-review.json`. It verifies the previously confirmed owner UUID against Auth and the current Team assignment. The schema has a shared Team role rather than a separate Admin role. Classification is a proposal with dependencies and uncertainties; **no deletion is authorized or performed**. Do not commit or publish that file.

All existing logo assets, logo components and branding styles remain unchanged. Hussein's supplied PNG is copied byte-for-byte; the existing portraits remain unchanged. The new approval manifest extends the repository's existing preservation checks without replacing historical manifests.
