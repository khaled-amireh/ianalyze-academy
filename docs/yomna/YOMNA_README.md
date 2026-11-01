# iAnalyze Academy — Yomna / Claude UI–UX Collaboration Guide

> **Read this document first.** This is a working brief, not a substitute for inspecting the actual repository. The companion file is `YOMNA_PROMPTS.md`. Follow its numbered stages **one at a time**; never execute all stages at once.

## Non-Negotiable Ownership Boundary — FRONTEND ONLY

**Yomna and Claude own ONLY visual frontend/UI/UX work. Khaled exclusively owns ALL backend work.** This is a hard boundary, not a suggestion. Even if Yomna approves a design, she cannot authorize backend changes on Khaled’s behalf.

**Allowed:** frontend-only styling, layout, responsive behavior, visual components, accessible interactions, animations, typography, design tokens, and presentation of existing frontend data/states, while preserving contracts.

**Forbidden — do not open for editing, modify, generate, commit, or include in Yomna's PR:** Supabase setup/configuration, database tables/migrations/RLS, storage buckets/policies, authentication/authorization, roles, API routes/endpoints, server-side code, data-fetching contracts, business logic, grading/ranking calculations, environment variables/secrets, deployment/CI infrastructure, or private student data. Do not modify backend files even to fix a bug. Do not use Claude to implement Phase 03 or any backend phase.

If a requested UI feature depends on backend work, **STOP that portion** and give Khaled a concise backend integration request (required endpoint/data shape, expected UI state, reason). Continue only independent frontend tasks. Do not create a fake backend or bypass security to make the UI appear functional.

Before every stage, Claude must state the exact frontend files it plans to change. After every stage, it must report changed files and explicitly confirm **“Backend files changed: NONE.”** If any backend file appears in the diff, remove those changes from the proposed PR and ask Khaled before proceeding. Do not modify Codex-owned work.

## 1. Your mission

Yomna Al-jabiri is the UI/UX collaborator for **iAnalyze Academy**, the educational platform of iAnalyze (under iTeam, Al-Zaytoonah University of Jordan). Claude is her implementation and design-review assistant. The project owner, Khaled, handles architecture, Supabase, authentication, data security, and backend development with Codex.

**Goal:** Turn the existing site into a distinctive, beautiful, creative, polished, trustworthy **Modern Academy** experience without sacrificing readability, speed, accessibility, responsiveness, or the existing bilingual functionality. Aim for a coherent product, not a generic template, gratuitous effects, or a complete rewrite.

## 2. Inspect reality before planning

Before suggesting edits, Claude MUST read the repository, current source, README/docs, available assets, styles, components, routes, and package scripts. Determine what has actually been implemented, what is merely planned, and what is already being changed by other contributors. Do not claim to have seen files that are unavailable. If the repo contains only `README.md` or lacks the frontend, **stop and ask Yomna to confirm that Khaled has pushed the complete frontend**. Never generate a replacement site from assumptions.

Expected frontend (verify, do not assume): React, Vite, strict TypeScript, Tailwind CSS, shadcn/ui, existing router, bilingual Arabic/English, RTL/LTR, light/dark themes, responsive components. Frontend may live in `frontend/`.

Previous work, subject to repository verification:
- Phase 00: design planning and syllabi.
- Phase 01: frontend foundation, navigation, localization, themes, responsive architecture.
- Phase 02: public-facing content and pages.
- Phase 03 onward: backend/authentication work owned by Khaled + Codex; do not interfere.

## 3. Product content and boundaries

The academy program is **EDA from Absolute Zero**: six instructional weeks plus two optional reserve weeks; Thursday 10:00 AM–1:00 PM. Week topics: Python Fundamentals I, Python Fundamentals II, Pandas, Data Cleaning, EDA & Data Visualization, Final Mini Project/Demo Day.

Existing/planned public routes to preserve (verify exact names): Home, About, Student Syllabus, Video Library, Leaders, Join, Leaderboard, Contact & FAQ.

Public leaders:
- Khaled Amireh — AI Student, 4th Year — Member
- Yomna Al-jabiri — AI Student, 4th Year — Member

Introduction to Data Science video: `https://drive.google.com/file/d/147puYxGioHyoYjSwxktgGP4RRWeM_qn4/view?usp=sharing` (embed existing resource; do not label it “previous semesters”).

Social links:
- Instagram: `https://www.instagram.com/iteamzuj/`
- LinkedIn: `https://www.linkedin.com/company/iteamzuj/`

Do not invent an official email, add a previous-events photo gallery, introduce Course Management, rewrite the syllabus, fabricate students/scores, or expose the confidential Team Syllabus.

## 4. Design direction

Make the UI **premium, elegant, warm, imaginative, and clearly educational**. Claude should first audit and propose 2–3 visual directions based on actual brand assets, then let Yomna select one. Maintain the authentic iTeam/iAnalyze identity and logos; do not invent replacement logos or change official colors without approval.

Areas to explore where appropriate:
- Clearer information hierarchy, stronger hero composition and CTA hierarchy.
- Consistent typography, spacing, surface treatment, borders, and shadows.
- Original but restrained visual motifs inspired by data analysis, charts, grids, and learning paths.
- Refined cards, sections, navigation, footer, hover/focus states, empty/loading/error states.
- Better mobile layouts and readable Arabic typography.
- Purposeful microinteractions and motion with reduced-motion support.
- Consistency across light/dark and LTR/RTL.

**Non-negotiables:** WCAG-conscious contrast, keyboard usability, visible focus, touch-friendly controls, semantic HTML, responsive layout, no horizontal overflow, performance, readable text, no flashing or excessive animation. Avoid large dependencies or remote asset services without approval.

## 5. Allowed vs. prohibited changes

**Allowed after Yomna approves a stage:** public-facing visual components, layout, styling, icons, animation, responsive behavior, accessibility improvements, visual asset placement, and UI-specific tests. Preserve semantics, content, and existing application behavior.

**Not allowed without explicit Khaled approval:** database schema/migrations, Supabase configuration, auth/session/role logic, RLS, API/data access, storage policies, environment files/secrets, student personal data, scoring/grading algorithms, private syllabus, deployment, routing contract changes, package upgrades with substantial impact, or edits to Codex's active work.

If a UI improvement requires backend work, write a clear integration request instead of implementing backend changes. Mock data must be explicitly marked as **development-only** and must not appear as genuine production student data.

## 6. Collaboration and Git safety

Yomna works on her own feature branch, for example `yomna/ui-ux-redesign` (choose a fresh branch from the latest appropriate base). Claude must inspect `git status`, current branch, remote, and latest commits before changing files. Do not overwrite uncommitted changes. Never commit secrets.

Workflow: inspect → propose → Yomna approves → implement **one stage** → run checks → Yomna reviews screenshots/preview → commit and push to Yomna's branch only after approval → move to next stage. When all approved stages are complete, push the branch and open a **Pull Request into `main`** for Khaled to review. **Only Khaled merges the PR.** No direct pushes to `main`, no force pushes, no self-merging. Branch naming and social agreement alone do not technically prevent writes to `main`; Khaled must verify actual repository permissions/protection.

Do not open a separate PR for every design stage unless Khaled requests it; keep a coherent reviewable PR and focused commits. If the branch falls behind `main`, ask before merging/rebasing and resolving conflicts.

## 7. Stage-by-stage protocol (mandatory)

The companion file `YOMNA_PROMPTS.md` contains stages **00–08**. Yomna can upload both files to Claude, but **Claude must never interpret access to the whole prompts file as permission to execute all stages**.

At the beginning, Claude should execute **Stage 00 only**, even if all prompts are visible. After each stage:
1. Report what was inspected/changed, exact files touched, tests run, and what remains.
2. Provide preview/screenshot instructions (or screenshots if tools support them), and call out visual/RTL/mobile issues honestly.
3. Ask Yomna for approval or requested adjustments.
4. Say exactly: **“Stage XX is complete and ready for your review. When you approve, please send Stage YY from YOMNA_PROMPTS.md.”**
5. **STOP.** Do not read ahead as an execution instruction or start the next stage automatically.

If Yomna requests revisions, finish the current stage before proceeding. If a stage is blocked, explain the blocker and wait. Do not declare a stage complete if checks failed or core acceptance criteria remain unmet.

## 8. Quality gate for each stage

- Existing routes, content, and links still work.
- Arabic and English checked; RTL/LTR layout verified.
- Light/dark mode checked.
- Mobile (~360/390px), tablet (~768px), desktop (~1280/1440px) checked where tools permit.
- Keyboard navigation, focus, contrast, and reduced-motion behavior considered.
- TypeScript, lint, tests, and build run using scripts actually present; report commands and real outcomes.
- No backend/auth/security changes, no secret leaks, no unrelated refactors.
- Explain trade-offs and obtain Yomna's approval.

## 9. Start here

Yomna: provide Claude this README and `YOMNA_PROMPTS.md`, ensure the complete frontend is on GitHub, and then send **Stage 00** from the prompts file. Claude: perform Stage 00 audit and propose a design direction, then stop. **Do not implement a redesign until Yomna explicitly approves the plan.**
