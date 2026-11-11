# Student registration and dashboard refinements

This document records pre-release local validation. The owner subsequently authorized the full production release on 2026-11-11; release results are reported with the Pull Request and GitHub Actions deployment.

Implemented locally for review on 2026-11-11. No commits, pushes, deployments, schema migrations, policy changes, or production data writes were performed. Pre-existing audit files were left untouched.

**Automatic registration progress.** Registration now saves non-secret draft fields locally as the student types or changes selections. The existing two-step architecture is retained: Create Account saves only email; the post-verification student profile-completion form saves name, phone/WhatsApp, major and custom major, academic year, Python experience, University ID, and preferred language. Profile drafts are scoped to the authenticated student's ID and are not used by profile editing or team accounts. University remains fixed and automatically assigned through the existing submission flow.

Drafts use versioned localStorage keys and a 24-hour expiry from the most recent allowed field edit. Expiration is checked on access; expired, corrupted, future-dated, incompatible, cross-scope, oversized-field, or unexpected-field records are discarded. Only explicitly allowed string fields are written. Passwords, password confirmations, tokens, secrets, account roles, university overrides, consent, and registration timestamps are excluded. No draft values are logged or sent to Supabase before submission. Names, phone numbers and IDs are personal information even though they are not secrets; the bilingual shared-device notice explains browser persistence and provides Clear saved information. Consent must be checked again after returning or clearing.

Restoration initializes controlled non-secret values synchronously before the first render. It does not listen for storage/focus events that could overwrite current input. Each edit merges only that changed field with the latest saved draft, avoiding stale whole-form writes from another tab. Language preferences and existing RTL/LTR behavior remain intact. Storage access errors do not prevent registration and produce a localized notice when progress cannot be saved.

Successful account creation clears the email draft; successful profile registration clears the student-scoped profile draft. Failed submissions retain progress. Navigation, refresh, tab switching, and closing/reopening a tab retain allowed fields. Reopening the profile-completion step requires the same authenticated account; this feature does not change session persistence or authentication configuration. Manual clearing removes the current form's draft, resets its non-secret controls to their saved/default values, clears password inputs and consent, and announces confirmation accessibly.

The draft follow-up modifies 11 files: the account and student forms, shared ID field, bilingual copy, three new draft helper/hook/notice modules, one new unit-test file, the existing browser regression script, this report, and its change manifest. The complete cumulative inventory is below. No dependencies were added.

**Confirmed unchanged-profile save fix.** The final review identified one compatibility bug: change detection correctly returned an empty patch, but the save helper still sent `PATCH {}` and requested one returned row. PostgREST treats that update as affecting zero rows, producing `PGRST116`. `updateOwnProfile` now returns `loadOwnProfile(client)` for an empty patch, so it reads the authenticated user's actual persisted profile without sending a PATCH. The existing successful-save callback then restores the read-only view. No success response is fabricated. Real read and update failures still propagate, and registration completion still runs when required. Existing trimming and phone normalization already reduce equivalent values to an empty patch; their behavior was preserved.

The unchanged-profile save follow-up changed only `frontend/src/lib/academy-data.ts`, added `frontend/tests/profile-save.test.ts`, strengthened `frontend/scripts/student-registration-browser-qa.mjs`, and updated this report and its change manifest. The runtime fix is one guard plus its explanatory comment. Tests first reproduced `PGRST116` before the guard and then passed after it. The installed Supabase query builder is exercised with intercepted transport. Both test fixtures now reject empty PATCH requests instead of silently returning a profile. Regression coverage includes unchanged Save, whitespace/phone normalization, genuine changes, update failure, read failure, registration completion/error propagation, Cancel without an update, and both student/profile edit routes returning to read-only mode.

**Student Dashboard.** The dashboard now loads only the authenticated user's personal profile and displays it in the existing profile-details layout. Saved fields are read-only until Edit Profile is selected. Save Changes validates the form, uses the existing Supabase save/re-read integration, immediately displays the returned profile, revalidates internally, and exits editing with success feedback. Cancel unmounts the form and discards the draft. Failed saves preserve the draft and show translated feedback. The separate `/profile/edit` route also returns to the read-only profile after Save or Cancel.

Weekly activities, the learning plan, upload/grade cards, empty activity placeholders, and the visible Refresh control are no longer rendered. The original learning and notebook functionality is retained in an unmounted `StudentLearningPlan` component. No syllabus data, activity records, tables, storage, or backend services were removed. A localized Try again action appears only if the initial profile request fails.

**Registration and validation.** The existing account creation → email verification → profile completion flow remains intact. University selection and the university-name input are removed from the shared registration/profile form. New student registrations automatically save the existing database-compatible value `Al-Zaytoonah University of Jordan`. Editing does not send a university update, preserving historical values. Read-only profiles display the saved university as fixed text, translated when it is the Al-Zaytoonah value.

University ID is required for student profile completion and student profile edits. Labels above the input are `University ID *` and `الرقم الجامعي *`. Validation trims surrounding whitespace, rejects empty values, email addresses, letters, internal spaces, non-ASCII numerals, and values exceeding the existing supported 1–20 digit rule. There is no invented fixed length. IDs remain strings, preserving leading zeros. The existing database duplicate-ID error maps to clear bilingual feedback. The input retains the existing 50-character entry limit so whitespace and over-20-digit entries reach validation instead of being truncated to a different valid ID.

The shared ID field shows the exact requested Arabic/English informational message on focus or click. It closes on blur or Escape, leaves typing and validation errors unobstructed, and exposes separate hint/error descriptions to assistive technology. The help uses existing theme tokens and follows the active language direction. Profile content uses English LTR or Arabic RTL while preserving the site's existing global navigation layout.

**Existing team profiles and security.** Only the verified `team` role can retain unchanged incomplete historical fields during profile edits. Newly entered values are validated, and existing populated required fields cannot be cleared. Incomplete team accounts can edit their profile without being forced through student registration. Updates whitelist personal fields and omit unchanged values; roles, permissions, identity, registration timestamps, and university changes are excluded from edit payloads. The Team Dashboard, Auth store, role checks, RLS, grants, SQL functions, migrations, email templates, and private syllabus were not changed. Owner and Yomna accounts were not accessed or modified.

**Navigation.** The shared desktop/mobile login link remains available to guests, including an unconfigured preview. It is hidden while authentication resolves and for signed-in users. Existing profile/dashboard navigation and logout remain intact.

**Verification results.**

| Check | Result |
| --- | --- |
| `npm run validate` | Passed, exit 0 |
| TypeScript and ESLint | Passed |
| Existing and updated unit tests | 77 passed, 0 failed; includes 6 save-helper and 8 draft regression tests |
| Prettier check | Passed |
| Production public build and Pages artifact checks | Passed |
| Production integrity and historical preservation checks | Passed |
| Embedded PostgreSQL security/regression tests | 32 passed, 0 failed |
| Generated database types against embedded schema | Passed |
| `npm run build` | Passed; TypeScript and Vite production build |
| Isolated Chrome browser suite | 39 grouped checks passed; 48 screenshots; no empty PATCH sent |
| Browser language/theme/size coverage | Arabic/English × light/dark × 320/390/768/1440px |
| Browser errors | No uncaught exceptions or console.error events; duplicate-ID and permission-denied update failures were deliberately simulated |
| Whitespace checks | `git diff --check` passed |

Browser checks cover registration validation and persistence through mocked Supabase responses, fixed university assignment, read-only profiles, populated editing, Save, Cancel, duplicate-ID feedback, page reloads, keyboard focus/Escape/Tab behavior, guest and authenticated navigation on desktop/mobile, horizontal overflow, and incomplete team-profile edits followed by continued workspace access. Embedded database tests cover actual SQL validation, uniqueness, ownership, private-data boundaries, and Leader/Organizer access. Existing preservation tests were extended with a separate explicit change manifest so unrelated files remain protected against their historical baselines.

Draft browser coverage additionally verifies internal privacy/page navigation and returning, browser refresh, switching actual browser tabs, closing and reopening the actual tab, same-user profile-draft restoration after re-login, empty restored passwords and unchecked consent, no password text in localStorage/sessionStorage, zero profile updates while typing, failed signup/completion retaining drafts, successful signup/completion clearing drafts, expired/corrupted/incompatible records, manual clearing, Arabic/English desktop/mobile behavior, restored custom-major values, and unchanged University ID validation/help. Unit tests also verify user isolation, strict field allowlisting, blocked storage, and merging the latest persisted fields instead of a stale snapshot.

Browser evidence is in `frontend/artifacts/student-registration/results.json`, with screenshots in the same directory. Validation and build logs are `frontend/artifacts/student-registration-validation.log` and `frontend/artifacts/student-registration-build.log`. These generated artifacts are ignored by Git.

**Verification limits and remaining risks.** No hosted account or production registration was exercised. Browser persistence used intercepted local fixtures; SQL behavior was verified with embedded PostgreSQL rather than a running Supabase Auth/email stack. The existing email verification and authentication implementation was preserved. Live owner/Yomna role assignments were not independently queried; no account, authorization, or database writes were made.

The existing database enforces numeric IDs for profiles assigned to Al-Zaytoonah. Historical other/unknown-university profiles retain the existing database rules, although the student UI now requires a valid ID. Universal enforcement through direct API calls for all historical profiles would require a separately approved migration and an account-compatibility review. No such migration was attempted; approval would be required before that additional work. No requested UI refinement remains incomplete.

**Exact modified and added files (24, including the save fix and drafts).**

| File | Status | Purpose |
| --- | --- | --- |
| `frontend/src/features/portal/student-page.tsx` | Modified | Profile-only dashboard, Save/Cancel, scoped registration draft restoration/cleanup, retained unmounted learning functionality |
| `frontend/src/features/portal/profile-page.tsx` | Modified | Shared read-only display, save/cancel navigation, incomplete-team compatibility |
| `frontend/src/features/portal/profile-details.tsx` | Added | Shared translated read-only personal information |
| `frontend/src/features/portal/profile-fields.ts` | Modified | Changed-field personal-data payload, trimming, automatic university assignment |
| `frontend/src/features/portal/form-validation.ts` | Modified | Required numeric ID and narrow historical-team exceptions |
| `frontend/src/features/portal/university-id-field.tsx` | Added | Accessible bilingual focus/click informational popover and controlled draft-compatible value |
| `frontend/src/features/portal/registration-draft.ts` | Added | Versioned allowlisted local draft storage, expiry, corruption handling, per-user isolation and field merging |
| `frontend/src/features/portal/use-registration-draft.ts` | Added | Synchronous restoration, automatic local saving and cleanup lifecycle |
| `frontend/src/features/portal/registration-draft-notice.tsx` | Added | Bilingual shared-device notice and accessible manual clear action |
| `frontend/src/features/portal/use-own-profile.ts` | Modified | Immediate own-profile update after saving |
| `frontend/src/features/portal/copy.ts` | Modified | Bilingual labels, exact help messages, and action text |
| `frontend/src/features/portal/auth-pages.tsx` | Modified | Shared login-link visibility, signup email drafts and successful-account cleanup |
| `frontend/src/features/portal/portal.css` | Modified | Theme-aware informational popover styling |
| `frontend/src/lib/academy-data.ts` | Modified | Read the persisted own-profile for empty patches; preserve real failures and registration completion |
| `frontend/tests/form-validation.test.ts` | Modified | Required ID and historical-team validation coverage |
| `frontend/tests/profile-patch.test.ts` | Added | Automatic university, normalization, unchanged-value and sensitive-field protection coverage |
| `frontend/tests/profile-save.test.ts` | Added | Six regression tests using the installed Supabase query builder and strict intercepted responses |
| `frontend/tests/registration-draft.test.ts` | Added | Eight local draft privacy, expiry, corruption, isolation, merging and validation regressions |
| `frontend/scripts/student-registration-browser-qa.mjs` | Added | Isolated browser fixtures, workflows, layout matrix, screenshots, and network isolation |
| `frontend/tests/pre-presentation.test.ts` | Modified | Account for this explicitly requested scope while preserving other historical boundaries |
| `frontend/scripts/verify-merge-preservation.mjs` | Modified | Separate hash-pinned registration refinement layer |
| `frontend/scripts/check-phase-03.mjs` | Modified | Include current authorized changes in inherited-file checks |
| `docs/student-registration/approved-changes.json` | Added | Exact source hashes, previous hashes, and reasons for this authorized scope |
| `docs/student-registration/report.md` | Added | Implementation, file inventory, validation results, and limits |

**Reproducing browser checks.** Start Vite on `127.0.0.1:5191` with `VITE_SUPABASE_URL=http://127.0.0.1:54321`, `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TEST_ONLY`, `VITE_ENABLE_REGISTRATION=true`, `VITE_PRIVACY_APPROVED=true`, and `VITE_ENABLE_DEV_PREVIEWS=false`. From `frontend`, run `node scripts/student-registration-browser-qa.mjs`. The script launches a dedicated headless Chrome profile, intercepts every API request, and blocks unexpected network origins. The fixture token is test-only and no real account is created. Chrome may require execution outside the restricted process sandbox.
