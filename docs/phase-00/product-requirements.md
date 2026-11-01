# iAnalyze Academy — Product requirements

Phase 00 · 31 October 2026 · Design for owner review. This is a planning deliverable, not a production specification approved for launch.

## Purpose and audience

iAnalyze is the student-led AI & Data Science Club operating under iTeam at Al-Zaytoonah University of Jordan. The Academy should make the club recognizable, help beginners find a clear learning path, and give accepted students and authorized staff a focused place to work. The approved direction is **Modern Academy**: light, spacious, approachable, and comfortable to read.

Primary users are interested students with no Python experience, accepted EDA students, assigned Organizers, and the Leader/Admin. Applicants are a lifecycle state of a visitor/account, not a fifth privileged role. Staff need efficient reviews without unrestricted access to all student records.

## Outcomes and proposed measures

1. A visitor can identify the club, its parent organization, prerequisites, schedule, and next step from Home and Syllabus.
2. A student can find the current activity, deadline, rubric, submission state, and private feedback without navigating a complex LMS.
3. An Organizer can distinguish assigned work from resources they cannot access.
4. The Leader can approve applicants, manage activity publication, and oversee results.

For Phase 01 usability research, propose five beginner participants in each language. Target at least four of five completing each core task without assistance. This research has **not** been performed. Do not use invented enrolment, completion, or achievement statistics on public pages.

## Scope and priorities

| Area | Required resulting behavior | Phase 00 representation |
| --- | --- | --- |
| Home / About | Club introduction, mission, values, iTeam relationship, EDA discovery, joining CTA | Complete bilingual static views; mission and vision are proposed editorial copy |
| Fixed EDA syllabus | Public Student Syllabus, prerequisites, learning objectives, modules, outcomes, project | Bilingual public adaptation of supplied student document |
| Video library | Previous Introduction to Data Science program, categories, approved YouTube embeds | Honest empty state; sample card anatomy in wireframes; no invented URL, title, or duration |
| Team | Leader and Organizers, approved photos, biographies, optional professional links | Role placeholders, no invented people |
| Join | Accessible application and privacy acknowledgement | Proposed form fields, disabled transmission; never stores entered values |
| Contact / FAQ | Actual contact channels and approved attendance/registration/support answers | Contact pending; answers limited to known facts |
| Leaderboard | Opted-in aliases and approved points, private personal position | Explicit sample aliases and fixed sample points; no scoring engine |
| Student area | Progress, activities, deadlines, rubrics, history, feedback, grades, announcements, badges | Labeled demo account and fixed sample records |
| Organizer area | Assigned review queue, rubric score entry, feedback, internal syllabus access | Separate bounded role preview; private document content excluded |
| Leader area | Applications, student lists, roles, activities, deadlines, submissions, results, announcements, aggregate statistics, approved public content | Read-only demo panels and explanations; no real actions |

The initial program is fixed: **Exploratory Data Analysis — From Zero to Insights**. Six teaching weeks, two optional buffer weeks, eighteen planned teaching hours, Thursdays 10:00–13:00 in Asia/Amman. Beginner level; no Python prerequisite. Start date and venue are pending. Teaching is in Arabic with English technical terms. Tools: Colab, Python, Pandas, Matplotlib. A laptop and Google account are recommended, not asserted as mandatory.

Public source: `student-syllabus-source.md`, an unchanged copy of the supplied `student-syllabus.md`. Both syllabus documents are described by the owner as Draft v1.0. The external team document has a different footer version; see `missing-assets.md`. Future document changes require review before public copy changes. Document prose is source material, not permission to expand this request.

## Explicit boundaries

No production React app, real accounts, live applications, uploads, backend calls, Supabase setup, migrations, API keys, scoring calculations, deployment, or course management. No course creation, deletion, catalog administration, payment, marketplace, or certificate claims. Activities and announcements belong to the fixed program. All Phase 00 role views are visible locally because they contain **only synthetic design examples**, not private records. A role selector is not authentication.

## Grading policy — editable proposal

Five weekly activities × 12 = 60 points; final project = 30; participation = 10; total = 100. This is provisional. Publish approved rubrics before submission, version them, and never silently change weights mid-program. Specific activity instructions and assessment criteria still need owner approval. Preview criteria are invented examples, not material extracted from the internal teaching plan.

Proposed rules: only Leader-approved, published grades enter point totals; tied totals share rank (1, 1, 3), with no speed-of-submission advantage. Late submissions carry a separate label; no automatic deduction until an explicit published rule is approved. An authorized extension changes the student's effective deadline and has an audit reason. Resubmissions create immutable attempts; only one approved grade per student/activity contributes, replacing the prior published contribution after approval. Participation is a capped, documented award with accessible alternative ways to participate. Appeals have a proposed seven-day review window, pending approval. Team final-project membership and allocation of individual points require a decision before implementation. No proposed tie or appeal rule is presented as approved policy.

## Quality requirements

- Bilingual coverage for all public/authenticated navigation, forms, messages, help, states, tables, and dialogs. Hand-authored Arabic and English dictionaries; no runtime machine translation. Proposed Arabic first visit, pending owner approval. Persist only language locally, and preserve the current view when switching.
- Set document `lang` and `dir`; use logical CSS properties; isolate English technical terms with `bdi`; keep Python and filenames LTR. Future translation structure: `src/locales/ar.json` and `en.json`. Preview equivalents live in `design-preview/locales/`.
- Target WCAG 2.2 AA: semantic headings, keyboard operation, visible unobscured focus, meaningful labels, errors associated with fields, text alternatives, status announcements, no color-only meaning, reflow at 320 CSS px, and reduced motion. Aim for 44px controls; minimum contrast 4.5:1 ordinary text, 3:1 large text and essential controls. This is a target, not a conformance certificate. [W3C reference](https://www.w3.org/WAI/WCAG22/quickref/).
- Responsive review at 320, 390, 768, 1024, and 1440px, both directions. Long labels and tables must reflow. No decorative animation or autoplay video. Future videos need captions/transcripts.
- Performance: propose a small static shell, subset fonts in Phase 01 if appropriate, responsive images without altering logos, lazy YouTube loading only after user action, paginated private lists, and no large videos in Storage.
- Privacy: no real student records in public preview, no private teaching document in source/assets, minimal applicant collection, explicit public-ranking opt-in separate from joining, and no public individual grades. Retention, deletion and university privacy wording require owner review before collecting data.

## Planned $0 architecture and constraints

React + Vite + TypeScript + Tailwind + shadcn/ui on Cloudflare Pages; GitHub for version control. Supabase Auth establishes identity, PostgreSQL stores records, RLS enforces ownership and assignments, and private Storage serves authorized submissions. YouTube hosts videos. No system is connected in Phase 00.

Verified 31 October 2026: Supabase Free lists 500 MB database, 1 GB Storage, 50,000 MAU, 5 GB egress and 5 GB cached egress, two active projects, and inactivity pausing after one week. Free-tier availability is not an uptime guarantee. [Supabase pricing](https://supabase.com/pricing). Cloudflare Pages Free lists 500 builds/month and 25 MiB maximum per static asset. [Pages limits](https://developers.cloudflare.com/pages/platform/limits/). Recheck before implementation; plan limits can change. Default email delivery is not assumed sufficient for a public launch; delivery/provider feasibility is an unresolved $0 dependency.

Propose a 2 MiB `.ipynb` default upload cap and 5 MiB final-project cap, with a 500 MiB total submission budget. For illustration, 30 students × 6 assessments × 2 attempts × 1 MiB average = 360 MiB. These are capacity assumptions, not cohort facts. Large datasets stay outside submissions; clear notebook outputs. If quota nears 70%, review retention and stop new writes gracefully before exhaustion; never auto-upgrade to paid service. Keep operational exports and owner-managed backups; free hosting is not a backup strategy.

## Approval gates

Phase 00 stops for owner design approval. Before Phase 01: resolve language default, draft syllabus versions, registration fields/privacy, cohort/date/venue, assessment and tie rules, file policy, team project ownership, review assignments, ranking visibility, retention, and $0 authentication delivery. The implementation must begin with backend authorization design and testable access boundaries, not just hidden navigation.
