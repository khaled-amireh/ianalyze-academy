# Bilingual content and registration audit — 2026-11-02 (Asia/Amman)

Completed on `codex/supabase-auth-integration`. No production data/configuration changes, push, merge or deployment were performed.

- Reviewed **457 Arabic/English pairs**: 264 public entries, 69 development-preview entries and 124 portal entries, plus literal JSX/privacy copy and database field selection. Automated audits check duplicate/missing keys, empty/corrupted values, matching interpolation placeholders and official technical names. Repeated labels are intentional; duplicate keys are rejected.
- Corrected Arabic grammar, university-level phrasing, EDA terminology, registration instructions, library names, file extensions and units. `Python`, `Pandas`, `NumPy` when present, `Power BI` and other official product names remain identifiable in English. The former dashboard “باندا” title is gone. Both dashboards derive fallback week titles from the same translated public syllabus. All six modules, order, hours, prerequisites and requirements remain unchanged.
- Team headings, review titles, rubric versions and week options now use the selected language rather than always English. Stored week descriptions are displayed in the chosen language; mixed-direction titles use bidi isolation, and long headings wrap on mobile. Personal names, identifiers and private student-entered values are not translated or rewritten.
- The read-only hosted content audit found **zero weeks, activities and rubric criteria**. There were no hosted educational rows to correct. Local fixtures verified both database languages, descriptions and long Arabic titles. A final counts-only hosted check found three completed registrations, all with required fields and consent intact; the existing Team assignment and user data were untouched by this work. submission/leaderboard gates remain closed.

## Registration behavior

Save waits for the own-profile update, registration RPC and a final server read-back of the same user’s registered profile. Only then is success shown. The confirmed profile immediately updates the dashboard, and learning content reloads in the background because registration changes what RLS releases. Students stay at `/student`; Team members return to `/workspace`. There is no signup, signout, replacement session, role assignment or Login redirect in this save path.

Already registered users see their dashboard and an explicit **Edit profile** action, not the registration form again. Failed saves retain entered values and remain on the form. Synchronous request guards and the existing unique profile/idempotent registration constraints prevent duplicates. Temporary session-verification errors fail closed with Retry rather than automatically forcing Login; genuinely ended sessions still require login. Server-side email verification, role enforcement and RLS are preserved.

## Executed checks

| Check                                               | Outcome                                                                                                                                                                                                                                                           |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript, ESLint, formatting and integrity checks | Passed; historical archives/assets and syllabus metadata preserved                                                                                                                                                                                                |
| Unit tests                                          | **34 passed**, including complete catalogue/key/placeholder/Unicode/technical-name audits                                                                                                                                                                         |
| Embedded database security                          | **21 passed**; simulated Auth/Storage fixture, not hosted proof                                                                                                                                                                                                   |
| Real local Supabase integration                     | **19 passed**; four new cases verify persisted registration, unchanged Student/Team sessions, idempotent retries and invalid/ended-session denial                                                                                                                 |
| Real local browser                                  | Signup, resend, recovery, Save handoff, same-session persistence, reload, registered-user view, failed-save values, duplicate submit, session retry/expiry and role separation passed; **20 public/Auth, 32 authenticated and 24 validation layout combinations** |
| Complete public layout suite                        | **160 cases, 38 interactions**, no layout/interaction/contrast failures or app exceptions; both languages/themes and mobile/desktop widths                                                                                                                        |
| Configured production candidate                     | Build and artifact scan passed; **56 navigation/layout/protection cases**, zero app exceptions and no hosted user writes                                                                                                                                          |
| Hosted verification                                 | Read-only educational content/role/gate audit and existing verified-owner release checkpoint passed; new hosted registration Save flow awaits the owner’s push/live test                                                                                          |

A browser regression caught that post-registration learning data also needed refreshing after RLS access changed; this was fixed and the full flow passed. Tests were adapted to the intended registered dashboard view instead of expecting the old always-visible profile form. No authorization assertion was relaxed. The optional external Drive video returned 200 with a player, but playback was not verified; it is outside this change.

Production readiness remains subject to the existing Actions deployment succeeding after the owner pushes. The new hosted Save behavior and external email recovery were not exercised with production user data in this audit. No new migration or Auth/Storage policy/configuration change is needed.

```powershell
git push -u origin codex/supabase-auth-integration
```

After Actions passes, test an already signed-in student completing registration, refreshing the dashboard, explicitly editing the profile, and a Leader returning to `/workspace` after saving. The expected outcome is no additional password prompt after a successful registration Save.
