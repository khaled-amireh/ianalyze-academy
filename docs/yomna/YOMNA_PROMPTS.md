# iAnalyze Academy — Yomna's Sequential Claude Prompts

> **Usage:** Give Claude `YOMNA_README.md` first, then this file. Send **only Stage 00** to start. Each stage requires Yomna's explicit approval before the next one. Claude must not execute later stages merely because they are visible in this document. Khaled remains the only person who merges the final Pull Request into `main`.

## Rules to prepend to every stage

Follow `YOMNA_README.md` and the real repository. Work only on Yomna's dedicated UI/UX branch; never push to `main`, merge, modify backend/auth/Supabase/security, or change confidential materials. Preserve AR/EN, RTL/LTR, light/dark, existing routes/content and functional behavior. Before implementing, verify the relevant files; after implementing, run available checks and provide a reviewable summary. Stop after the requested stage, ask for Yomna's review, and explicitly request the next numbered prompt **only after she approves**. Do not auto-run the whole roadmap.

---

## Absolute Rule for Every Prompt — FRONTEND ONLY

**Yomna + Claude = UI/UX frontend only. Khaled + Codex = 100% of backend.** No exceptions unless Khaled separately reassigns ownership in writing. Never modify Supabase, database, migrations, RLS, auth, roles, APIs, server code, storage rules, business logic, environment files, deployment, or private data. Do not implement backend dependencies yourself; describe them as integration requests for Khaled. Before edits, list frontend files in scope. After edits, list all changed files and write **“Backend files changed: NONE.”** If this cannot be confirmed, STOP and resolve the scope violation before commits or PR. A UI stage cannot authorize backend work.

## Stage 00 — Repository audit + creative design proposals (NO CODE CHANGES)

**Prompt to send Claude:**

Read `YOMNA_README.md` completely and inspect the actual `ianalyze-academy` repository. Identify frontend source location, current branch/status, routes, component structure, existing brand assets, CSS/theme tokens, Arabic/English and RTL/LTR handling, light/dark modes, scripts, tests, and the current visual quality. If the complete frontend has not been pushed, STOP and tell me. Do not edit code, create commits, or push anything.

Deliver:
1. Evidence-based UI/UX audit, organized by page, with severity and opportunity.
2. What already works well and must be preserved.
3. 2–3 distinct **premium, creative, practical** visual directions consistent with existing iTeam/iAnalyze branding. For each, describe typography, colors (reuse brand), layout, hero, cards, motion, accessibility, and implementation cost.
4. Your recommended direction and a prioritized, stage-by-stage plan.
5. Exact files you would likely touch, risks, and anything you need from me (only missing assets/information).
6. How you will avoid conflicts with Khaled/Codex's backend work.

Ask me to select/approve a direction. **Do not implement anything yet.** End with: “Stage 00 is complete and ready for your review. When you approve, please send Stage 01 from YOMNA_PROMPTS.md.”

**Acceptance:** real repository inspected; no files modified; Yomna approves a design direction.

---

## Stage 01 — UI design system and shared foundations

**Prompt to send Claude:**

I approve the visual direction chosen in Stage 00. Implement **Stage 01 only** on my dedicated UI/UX branch. Refine the existing design system without rebuilding the app: brand-consistent design tokens, typography scale (including Arabic), spacing, containers, surface hierarchy, buttons, inputs, cards, icons, focus states, navigation primitives, and responsive utilities. Maintain existing component APIs and all behavior. Keep both themes and RTL/LTR robust. Use restrained, intentional motion and respect `prefers-reduced-motion`.

First outline the precise files to touch; if any change crosses backend/auth boundaries, stop and ask. Implement in small focused commits only after my approval to proceed. Run existing checks. Show before/after observations and explain how later page stages will reuse the system. Do not redesign all pages yet.

End by asking for review and, only after approval, Stage 02. **STOP.**

**Acceptance:** consistent reusable foundations, no regressions, tests/build reported, approved by Yomna.

---

## Stage 02 — Home page: standout first impression

**Prompt to send Claude:**

Implement **Stage 02 only**: redesign/refine the existing Home page using the approved visual direction and Stage 01 foundations. Create a memorable, polished, distinctive hero for an EDA learning academy, with a clear headline, useful CTAs, elegant visual storytelling, refined section transitions, and coherent learning/program highlights. Prioritize meaningful information over decorative clutter. Use real project content; do not invent results, student numbers, events, or testimonials. Optimize mobile, Arabic RTL, dark/light, accessibility, and load performance. Avoid heavy animation and new dependencies without approval.

Present screenshots or reliable preview instructions at mobile and desktop widths, a concise changed-file list, and actual test/build outcomes. Do not touch other pages beyond necessary shared fixes. Ask for my review and then Stage 03 **only if approved**. **STOP.**

**Acceptance:** compelling home page, accurate content, clear CTAs, no responsive or localization regressions.

---

## Stage 03 — About + Student Syllabus: clarity and learning journey

**Prompt to send Claude:**

Implement **Stage 03 only**. Improve the About and Student Syllabus pages to feel premium and exceptionally clear. Present the academy purpose and six-week “EDA from Absolute Zero” journey using accessible visual hierarchy, timeline/cards, and thoughtful content grouping. Preserve the actual six topics, two optional reserve weeks, and Thursday 10:00 AM–1:00 PM schedule. Do not rewrite the syllabus or expose the confidential Team Syllabus. Ensure Arabic/English parity, RTL/LTR, mobile readability, both themes, and keyboard accessibility. Reuse approved design-system components.

Report changes, show previews or preview instructions, run checks, ask for approval, then request Stage 04. **STOP.**

**Acceptance:** accurate and easy-to-scan curriculum; no private material exposure.

---

## Stage 04 — Video Library + Leaders: media and people

**Prompt to send Claude:**

Implement **Stage 04 only**. Refine Video Library and Leaders pages with a cohesive, elegant media presentation and attractive but respectful profile cards. Preserve the Introduction to Data Science Google Drive embed and existing working playback behavior; do not call it “previous semesters.” Preserve existing leader portraits, names, and labels: Khaled Amireh and Yomna Al-jabiri, both AI Student, 4th Year, Member. Do not alter identities, replace portraits, or fabricate new photos. Make embeds responsive with accessible fallbacks and clear loading/error behavior where feasible. Keep AR/EN, RTL/LTR, dark/light, and performance in mind.

Report what was verified versus what requires manual playback testing. Ask for approval and Stage 05. **STOP.**

**Acceptance:** good mobile video experience and polished, accurate leader profiles.

---

## Stage 05 — Join + Leaderboard + Contact/FAQ: usable states

**Prompt to send Claude:**

Implement **Stage 05 only**, focusing strictly on the UI/UX of Join, Leaderboard, and Contact/FAQ. Improve form layout, validation message presentation, CTA clarity, empty/loading/error states, privacy explanations, ranking readability, FAQ scanning, and contact links. Do not implement or change authentication, registration, RLS, data fetching contracts, grading, ranking calculations, or backend logic. Respect the current phase: if real backend data is not ready, retain honest placeholder/empty states; never pretend fake users are real. Registration will eventually collect WhatsApp numbers for private team use; do not display them publicly. Preserve iTeam Instagram and LinkedIn; do not invent official email.

Test accessibility, responsive behavior, both languages and themes. Report any backend requirements as requests for Khaled/Codex. Ask for review and Stage 06. **STOP.**

**Acceptance:** intuitive screens, honest states, no backend/security edits.

---

## Stage 06 — Microinteractions, motion, mobile polish

**Prompt to send Claude:**

Implement **Stage 06 only**. Conduct a whole-site UI polish pass: tasteful hover/focus transitions, subtle reveal or scroll effects where appropriate, navigation feedback, section rhythm, mobile menus, touch targets, typography and spacing, overflow fixes, and reduced-motion accessibility. Do not add animation for its own sake. Avoid expensive effects, flashing, scroll-jacking, or heavy new dependencies. Maintain Arabic RTL and both themes. Identify performance issues and resolve UI-only causes.

Provide a clear before/after checklist, device-width test results, and screenshots or reproducible previews. Ask for approval and Stage 07. **STOP.**

**Acceptance:** polished, fast, accessible mobile and desktop UX; no motion-related regressions.

---

## Stage 07 — Full QA, visual consistency, accessibility

**Prompt to send Claude:**

Perform **Stage 07 only**: comprehensive review and fixes limited to UI/UX scope. Audit all public routes at ~360/390px, ~768px, and ~1280/1440px where testing tools permit, in Arabic and English, RTL/LTR, and light/dark. Verify navigation, links, focus order, keyboard use, contrast, semantics, reduced-motion, touch targets, visual consistency, overflow, and critical empty/error states. Run actual TypeScript, lint, test, and production build scripts found in the repository. Do not claim unrun checks passed. Fix only confirmed UI regressions, document any backend-owned issues separately, and present a release-quality QA report.

Do not open/merge a PR yet. Ask for my review and Stage 08. **STOP.**

**Acceptance:** transparent QA evidence, no known blocking UI issues, Yomna approval.

---

## Stage 08 — Final review, push branch, create PR (NO MERGE)

**Prompt to send Claude:**

This is **Stage 08 only**, and I confirm that Stages 00–07 have been reviewed and approved. First verify the current branch is Yomna's dedicated UI/UX branch, check `git status`, inspect all diffs, and ensure no secrets, private syllabus, backend/auth/Supabase changes, or unrelated modifications are included. Run final available checks and report their actual results. Prepare meaningful commits for approved changes, then **ask my permission before pushing**. Once I approve, push **only Yomna's branch** and open a Pull Request targeting `main` if GitHub access supports it. If PR creation is unavailable, provide precise manual GitHub steps and a ready-to-paste PR description.

PR description must include design goals, page-by-page changes, screenshots/preview links if available, accessibility/responsiveness checks, test results, risks, and any backend integration requests. **Never push directly to `main`, force-push, merge the PR, or approve your own work.** Khaled reviews and merges.

Finish by reporting branch, commit(s), PR URL if created, checks, and pending reviewer actions. **STOP.**

**Acceptance:** approved changes isolated in Yomna's branch; owner-reviewable PR; no merge.

---

## Reusable prompt — Revision of current stage (use anytime)

**Prompt to send Claude:**

Stay within the **current stage**. I am not approving the next stage yet. Apply only the following UI/UX feedback: [INSERT MY FEEDBACK]. Explain proposed edits, preserve existing behavior and localization, run relevant checks, show the updated result, and ask me to review again. Do not proceed to any later stage, push, or merge.

---

## Reusable prompt — Status / handoff (use anytime)

**Prompt to send Claude:**

Without changing files, summarize the current stage, approved visual direction, branch name, completed work, files changed, tests run with outcomes, blockers, unresolved issues, and the next exact stage number. Distinguish verified facts from assumptions. Wait for my instruction before further work.
