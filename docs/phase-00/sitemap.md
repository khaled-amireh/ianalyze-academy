# Information architecture and sitemap

Phase 00 proposal. Routes below are future routes; the static preview uses hash navigation, not real protected routes.

## Page hierarchy

```text
Public shell
  /                         Home
  /about                    About iAnalyze + iTeam relationship
  /eda                      Fixed EDA program + Student Syllabus
  /videos                   Previous Introduction to Data Science library
  /team                     Leader / Organizer placeholders
  /join                     Application (future)
  /leaderboard              Opted-in aliases + approved totals only
  /contact                  Contact + FAQ
  /privacy                  Approved privacy notice (future prerequisite)
Identity shell (future only)
  /sign-in                  Sign in / recovery / session expiry
  /application              Own application status; no student powers yet
Student shell (accepted account)
  /student                  Overview + progress + announcements
  /student/activities       Released weekly activities + project
  /student/activities/:id    Instructions + rubric + deadline + own submissions
  /student/submissions      Own attempt history + private feedback/grades
  /student/achievements     Personal points + earned badges + ranking position
  /student/settings         Profile + language + leaderboard privacy
Organizer shell (assigned scope)
  /team-space               Assigned queue + review counts + announcements
  /team-space/reviews/:id    Authorized submission + rubric + draft feedback
  /team-space/progress       Assigned student progress only
  /team-space/syllabus      Authorized private Team Syllabus, server-served
Leader shell
  /admin                    Operational overview
  /admin/applications       Review / accept / waitlist / reject
  /admin/students           Students + assignments
  /admin/roles              Organizer grants + revocations
  /admin/activities         Fixed-program activities, release dates + deadlines
  /admin/reviews            Grades / feedback / approval + result publication
  /admin/announcements      Draft + publish by audience
  /admin/content            Approved public copy / videos / team profiles
  /admin/syllabus           Authorized internal document
```

No course catalog or course-management routes. Unsupported deep links need a clear not-found state; forbidden private routes must reveal no resource contents or existence-sensitive metadata. Session expiry preserves safe navigation intent without caching submission data in public storage.

## Navigation

Public desktop: iAnalyze identity links Home; primary links Home, EDA Syllabus, Video Library, About, Team; Join CTA; visible AR/EN control. Footer includes leaderboard, contact/FAQ, parent iTeam identity and pending contact notice. Mobile: disclosure button with `aria-expanded` reveals the same routes; language control remains visible. Active route uses text and underline, not color alone.

Dashboard: compact top identity + language, role-specific sidebar starting at the reading edge (right in Arabic). Student items prioritize Overview → Activities → Submissions → Achievements. Organizer items prioritize Assigned Reviews → Student Progress → Team Syllabus. Leader items prioritize Overview → Applications → Activities → Reviews → Announcements → Roles. On mobile, sidebar becomes a wrapping navigation row/disclosure before content. Keep review and submission primary actions close to their relevant context.

Phase 00 has a clearly marked preview selector for all design views. It is a review aid and must never become production role switching. Its Student/Organizer/Leader links open synthetic demonstrations without access to the actual private syllabus.

## Key journeys

| Audience | Entry → next action → result |
| --- | --- |
| Beginner visitor | Home → Syllabus → prerequisites / schedule → Join → see proposed application fields |
| Returning visitor | Library → prior-program context → honest empty state until URLs arrive |
| Applicant, future | Join → receipt → own review status → acceptance → authenticated onboarding |
| Student, future | Overview → current activity → rubric → upload → history → reviewed feedback |
| Organizer, future | Assigned queue → authorized review → draft scores/feedback → submit for approval |
| Leader, future | Pending applications → decision; review drafts → publish approved results |
| Privacy-conscious student | Settings → choose alias + opt-in → public total only; private rank available independently |

Full state transitions and recovery paths are in `user-flows.md`. Desktop/mobile compositions and the wireframe gallery are in `wireframes.md` and `design-preview/#wireframes`.
