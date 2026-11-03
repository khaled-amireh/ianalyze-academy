# iAnalyze Academy — implementation and local verification

Date: **3 November 2026, Asia/Amman**. Work completed in the existing React/TypeScript/Vite/Tailwind/Supabase architecture. No rebuild, push, merge, commit or deployment was performed. Hosted Supabase settings and records were not changed.

## Requirement outcomes

| Request                          | Result                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iTeam branding                   | Compared the supplied PNG/WebP and original references. The generated transparency has colored edge artifacts and visibly different rendering/proportions. It was not substituted. Existing theme-specific iTeam assets remain in use and pass light/dark display checks.                                                         |
| iAnalyze restriction             | All seven iAnalyze image assets, the shared logo component and the existing logo/layout stylesheet remain byte-identical. A new regression test pins these nine files. No resizing, repositioning, filters or recoloring was applied.                                                                                             |
| Jordanian phone input            | Local, `+962` and `00962` formats normalize to canonical `+962…`. Client and database validation agree on prefixes, length and separators. Natural bilingual labels, the requested placeholder and LTR digit display are implemented.                                                                                             |
| Arabic/English audit             | Audited public, portal and development catalogues for completeness, placeholders, encoding, technical terminology and duplicate keys. Updated phone/year/verification/participant copy. Feedback stores translation keys so a language switch also translates an existing message. RTL/LTR layouts pass browser checks.           |
| Password visibility              | One shared password control covers signup, login and reset. The wrapper and password text use a consistent LTR geometry with reserved padding and a 44px toggle target. Both pointer and keyboard show/hide checks pass in both page directions.                                                                                  |
| Academic years                   | New choices are First Year through Fifth Year, with natural Arabic labels. Historical out-of-range values remain readable and can be retained in an already registered profile without being offered as new registration choices.                                                                                                 |
| Verification email               | Exact bilingual confirmation and recovery HTML templates supplied, with buttons, copyable primary links and generated Supabase fallback links. Loaded and tested locally. Hosted installation is pending; see the handoff.                                                                                                        |
| Verification callback            | Handles PKCE codes and generated email/signup/recovery hashes. Scrubs query/fragment credentials, rejects invalid/ambiguous input, verifies the session and authoritative role before routing, and provides error/resend actions. Only pending exchanges are deduplicated, avoiding cached success for a later used-link attempt. |
| Registration/session persistence | Retained the secure own-profile save and idempotent consent RPC. Verified that Student and Team Save retain identity/session and open the correct dashboard; failed saves retain form values. New signup automatically receives Student from the existing database bootstrap, with no approval or elevated role.                  |
| Private participant data         | Team workspace now displays name, email, phone, major, year, Python experience, optional university ID, preferred language and registration date. Missing optional data uses localized copy. Readable columns stay inside an accessible horizontal scroll region.                                                                 |
| Feedback/accessibility           | Existing accessible notice component now also covers dashboard/editor/upload feedback, with red errors, green success, text and icons. Validation links errors to fields and focuses the first invalid field. Ref guards prevent duplicate async submissions in relevant forms.                                                   |
| Regression/security              | TypeScript, lint, formatting, unit, embedded PostgreSQL, real local Supabase, pgTAP, production builds and browser checks pass. Specific external/device limitations are recorded below.                                                                                                                                          |
| Safety/scope                     | No student data deletion, destructive migration, security relaxation, new dependencies or unrelated redesign. Only synthetic local test fixtures were created/cleaned up. No release commands were run.                                                                                                                           |

## Phone validation and historical data

The shared client contract is `frontend/src/lib/jordanian-phone.ts`; the database equivalent is `app_private.normalize_jordanian_mobile`, installed by the new forward migration.

| Accepted example | Stored result   |
| ---------------- | --------------- |
| `0797232936`     | `+962797232936` |
| `+962797232936`  | `+962797232936` |
| `00962797232936` | `+962797232936` |
| `(079) 723-2936` | `+962797232936` |

- Local numbers require exactly 10 ASCII digits and a `077`, `078` or `079` prefix.
- International forms require exactly the equivalent Jordanian mobile digits. Extra zeros, missing digits, other countries/prefixes, embedded letters, extensions and misplaced plus signs fail validation.
- Ordinary spaces, NBSP/narrow NBSP, parentheses, periods and hyphens are accepted as separators. Input is bounded to 64 characters. Unsupported characters are rejected instead of silently removed.
- Client and SQL are checked against the same 23-case corpus, including all required formats and malformed cases.
- The database trigger runs validation when phone/year is newly supplied or changed. It does not rewrite any existing row during migration and does not normalize an unchanged legacy international number.
- A profile save omits an unchanged phone. Historical year values can be retained on an existing registered profile; selecting a new year is limited to 1–5. Registration with an older out-of-range default requires a new valid selection in the form.
- No historical phone/year constraint was destructively replaced, and no existing consent/registration timestamp was reset.

## Logo decision and preservation

The active assets remain `frontend/src/assets/brand/iteam-on-light.png` and `iteam-on-dark.png`. Their original source artwork and all other logo assets are untouched. The newly attached generated artwork was not copied into the project.

The generated attachments have bright cyan/red/orange edge residue and differences in the mark/wordmark rendering compared with the attached originals. The current repository also uses an established flat iTeam lockup with the university/faculty wording, while the new attachments show a glossy lockup. Approving a different official lockup or supplying a faithful official transparent export is a branding decision for the owner. No artwork was recreated, recolored, cropped or otherwise altered.

[branding-preservation.json](branding-preservation.json) records hashes for all seven iAnalyze assets and the shared component/layout. `tests/branding.test.ts` verifies them. The theme browser suite confirms reserved size, loaded variants and absence of white logo tiles. Shared branding CSS and the logo component have no diff.

## Registration, authentication and authorization

The existing `saveAcademyProfile` implementation already avoids signing the user out. It remains unchanged. The audit retained that secure flow rather than introducing another Auth call during Save. Real browser regression tests demonstrated successful Student and Team registration, unchanged session identity, no redirect to login, idempotent duplicate Save, retained values on a failed completion RPC, reload persistence, refresh-token renewal and session-verification retry. The previously reported hosted Save issue was not claimed to have been reproduced or verified on production.

New verification routing waits for `auth.refresh()` and the verified store snapshot before navigating. Students reach `/student`, authorized Team users reach `/workspace`, and recovery reaches `/auth/reset`. No destination is read from an arbitrary `next` URL. Old implicit fragment credentials are not trusted; those links receive clear login/new-link guidance. New primary token-hash emails work in a browser without the signup/recovery PKCE verifier. The fallback Supabase URL retains its same-browser PKCE behavior.

Successful email verification is displayed with a green confirmation notice. Signup explains the next step and exposes resend directly. Used, expired and invalid links provide login, recovery and resend actions. Resend has duplicate-request protection and a one-minute UI cooldown; Supabase remains the authoritative rate limiter. Password reset still intentionally signs out after changing the password.

The existing database bootstrap assigns only `student`; editable user metadata cannot grant Team privileges. Leaders and Organizers continue to share the existing verified `team` role. The existing `profile_read` RLS policy restricts private profiles to their verified owner, or verified Team members for registered participants. The expanded table uses this same protected query. No new public view, contact export or policy was introduced.

Security tests covered anonymous access, unverified accounts, Student A versus Student B, protected fields, role metadata forgery, role-table writes, Team revocation with the existing session, grade privacy, storage ownership and both Team assignments. All ten application tables retain RLS. Public RPCs remain invokers, private definer search paths remain fixed, and the new validation helpers do not elevate privileges.

## Test results

Final command outcomes are recorded in [validation-results.json](validation-results.json). Counts below are the test runners' own counts; browser layout cases, interaction assertions and contrast samples are reported separately rather than added into a misleading total.

| Check                                                                   | Passed | Failed |
| ----------------------------------------------------------------------- | -----: | -----: |
| Unit tests, including localization, callback deduplication and branding |     40 |      0 |
| Embedded PostgreSQL security/registration tests                         |     29 |      0 |
| Real local Supabase Auth/REST/Storage/Edge/registration/email tests     |     23 |      0 |
| Local Supabase pgTAP security assertions                                |     15 |      0 |
| Public-page language/theme/viewport cases                               |    160 |      0 |
| Public-page interaction assertions                                      |     38 |      0 |
| Public sampled contrast cases                                           |     32 |      0 |
| Theme/logo assertions                                                   |     17 |      0 |
| Focused real-backend registration/verification browser checks           |     75 |      0 |
| Email HTML preview renders at mobile/desktop widths                     |      4 |      0 |

The existing delivery browser suite additionally passed 20 public/Auth responsive cases, 32 authenticated Student/Team layout cases, 24 validation/error layout cases and its workflow assertions. It exercised real signup mail, PKCE and token-hash recovery, Save, refresh, cross-tab logout, authorized grading, file delivery and privacy. The focused suite covers 64 language/theme/width form combinations plus 11 workflow/accessibility checks.

`npm run validate` passes in full: TypeScript, ESLint, 40 unit tests, Prettier, the production public build, production/Pages boundaries, historical preservation checks, 29 embedded tests and generated database type consistency. Real local database types also match. Local pgTAP reports 15/15. The configured local production-mode build is separately exercised against local Supabase; it is not a hosted production verification.

Widths exercised include 320, 390, 768, 1120 and 1440px across the relevant suites. Arabic/RTL, English/LTR, light/dark and keyboard interactions were covered. Representative screenshots were visually inspected, including Arabic mobile password/profile/reset pages and the complete participant table. The table wrapping was corrected following that inspection.

Intermediate failures were resolved: the old phone test expected local numbers to fail; a date-value assertion compared object identity instead of value; the Edge runtime initially used closed local settings before the existing local serve command was started; the old preservation guard needed the separately pinned authorized scope; and browser waits needed to allow asynchronous controls and fast production callbacks. Final counts above exclude superseded failed attempts and accurately describe the final successful runs.

## Modified and added files

The exact final Git status and per-file inventory are in [working-tree.txt](working-tree.txt) and [changed-files.txt](changed-files.txt).

Modified tracked files:

- `frontend/package.json` — test commands.
- `frontend/scripts/check-phase-03.mjs`, `check-redesign.mjs`, `verify-merge-preservation.mjs` — preserve historical checks while verifying both original and final hashes for this authorized scope.
- `frontend/scripts/database-fixture.mjs` — replay pre-migration fixtures for preservation tests.
- `frontend/scripts/phase-04-browser-qa.mjs` — revised contract/copy expectations and configurable dedicated debugger.
- `frontend/scripts/redesign-browser-qa.mjs`, `theme-brand-browser-qa.mjs` — evidence dates use Asia/Amman instead of fixed historical dates.
- `frontend/src/features/portal/auth-pages.tsx` — verification/resend/routing.
- `frontend/src/features/portal/copy.ts` — bilingual copy.
- `frontend/src/features/portal/form-validation.ts` — phone/year/legacy validation.
- `frontend/src/features/portal/portal.css` — password and private table geometry.
- `frontend/src/features/portal/student-page.tsx` — profile normalization/options/feedback/submission guard.
- `frontend/src/features/portal/team-page.tsx` — complete private fields, translated notices and guards.
- `frontend/src/locales/ar.json`, `en.json` — natural phone labels.
- `frontend/src/pages/public/join-page.tsx` — preview phone placeholder/direction.
- `frontend/tests/form-validation.test.ts` — revised validation coverage.
- `supabase/config.toml` — local email template paths only.

New implementation/test files:

- `frontend/src/lib/jordanian-phone.ts`
- `frontend/src/features/auth/email-callback.ts`
- `frontend/src/features/portal/academic-years.ts`
- `frontend/scripts/registration-browser-qa.mjs`
- `frontend/tests/branding.test.ts`
- `frontend/tests/email-callback.test.ts`
- `frontend/tests/jordanian-phone.test.ts`
- `frontend/tests/fixtures/jordanian-phones.ts`
- `frontend/tests/registration.security.test.mjs`
- `frontend/tests/verification.integration.test.mjs`
- `supabase/migrations/20261103000100_registration_validation.sql`
- `supabase/templates/confirmation.html`
- `supabase/templates/recovery.html`

New documentation/evidence lives under `docs/final-quality/` and is fully enumerated in the inventory. No dependency or lockfile was changed. Historical preservation manifests were retained; [approved-changes.json](approved-changes.json) records the current user-authorized deltas separately.

## Hosted handoff, limitations and next steps

1. Review the code, forward migration and [exact email-template/dashboard instructions](SUPABASE-EMAIL-SETUP.md). The new migration and templates are applied locally only; hosted configuration is pending approval.
2. Obtain approval for any push/release. The existing `.github/workflows/production.yml` deploys on pushes to both `main` and `codex/supabase-auth-integration`. A push to the current branch can therefore trigger deployment. That workflow was not changed or triggered.
3. In an approved release, confirm the canonical Site URL/redirect allowlist, preserve verification/security/expiry/SMTP limits, and install the supplied templates with the compatible frontend and migration.
4. Test the actual hosted registration/Save flow and mail delivery after deployment. No hosted feature was verified by this task.
5. Complete physical iOS/Android mail-app handoffs, Safari/Firefox and actual Gmail/Outlook rendering. Chrome desktop and mobile viewport emulation passed; physical-device behavior is not claimed.
6. Resolve the branding choice only if a replacement iTeam logo is still desired. The AI-generated asset was rejected under the supplied branding rule, and the established artwork remains.
7. The unchanged external Google Drive player loaded, but automatic playback did not advance in the public browser attempt. Its fallback link remains available; actual playback needs a manual external-service check.
8. Vite continues to warn that the main minified bundle exceeds 500kB. The production builds succeed. No unrelated dependency or bundling redesign was introduced.

## Git and local state

Branch: **`codex/supabase-auth-integration`**. The working tree contains uncommitted changes, with no staged changes or new commits. Exact HEAD and final status are recorded in [working-tree.txt](working-tree.txt). No push, merge or deployment occurred.

The project-local Supabase stack was started, its existing local volumes preserved, and only the new forward migration applied. Synthetic users/learning records/files created by tests were cleaned up and temporary submission/ranking gates restored closed; [local-state.json](local-state.json) records the final zero-user/profile/submission/file inventory. Local generated test configuration and build output remain ignored. The local stack and owned preview/browser processes were stopped after verification, with local volumes preserved. The user's personal browser was not used for automation.

The Supabase CLI emitted its standard local development credentials when it started the test stack. No hosted credentials were read or printed. Those local values are excluded from tracked evidence, and the test endpoints were stopped during teardown.
