# iAnalyze Academy frontend redesign

Work branch: `design/ultimate-ui-ux-redesign`, based on the requested `origin/design/zain-ui-ux-redesign`. Both the original Zain branch and `main` pointed to `5bd9383` at inspection. See the [pre-implementation audit](audit.md).

The subsequent [theme/logo update](theme-brand-update.md) applies the owner's blue light palette, violet/cyan dark palette and four supplied logo variants. Browser screenshots and layout evidence reflect that update. Lighthouse numbers below describe the original redesign build before this palette update.

The public website now uses a compact shared header, a syllabus-led homepage, a touch curriculum carousel, clearer page headings, quieter information panels, original team portraits, and consistent light/dark surfaces. Manrope and IBM Plex Sans Arabic replace the previous font downloads; fonts ship locally with their licenses. Arabic/English switching updates both document direction and the carousel. Saved theme preferences override the initial system-theme fallback.

Motion's mini API handles short, one-time entrances; CSS handles hover/focus feedback; Embla handles touch dragging and explicit navigation. Reduced motion removes the entrances and makes carousel button navigation immediate. All content remains rendered before animation and available to assistive technology.

## Scope and preserved behavior

All existing public URLs and navigation labels remain. The syllabus, real video URL, official social links, registration field order, consent, and original assets are preserved. Optimized logo derivatives are additional files; original logos and team portraits remain byte-identical.

Registration is still a disabled preview. The leaderboard still has no published results. Login, student activities, submissions, grading and operational dashboards remain implementation gaps, with development previews excluded from production. This change does not introduce mock student records or imply those features are functional.

Supabase files, migrations, RLS, generated database types, authentication, authorization, API contracts, environment files, hosting and deployment configuration are unchanged. Production deployment and cloud-configuration changes are outside this redesign.

## Review locally

From `frontend`, run `npm.cmd run build` and `npm.cmd run preview`, then visit <http://127.0.0.1:4174/>. Use `npm` in shells without PowerShell's script restriction.

`npm.cmd run validate` runs types, lint, Node tests, formatting, build, original production checks, the redesign preservation check, embedded database regression tests, and generated-type verification. The embedded tests use test-only in-memory fixtures; they do not contact hosted Supabase.

Historical Phase 02/03 checks and baselines are unchanged. Their file-freeze/dependency-addition policies describe those historical phases; `check:redesign` replaces those two phase-specific steps in the current validation pipeline. It preserves old package entries, verifies the nine pinned transitive/direct additions, checks historical files outside the explicit presentation list, scans for secrets, and rejects protected backend/auth changes. Review the [explicit presentation/dependency manifest](approved-presentation-changes.json).

The isolated Chrome harness is `npm.cmd run test:browser:redesign`. It expects a task-owned headless Chrome at port 9225 and the production preview at port 4174, as documented in the existing frontend README. It disables browser cache during its repeated full-document matrix to avoid cancelled font-request reuse. It writes results and screenshots into this directory.

## Visual review

- [English desktop homepage](screenshots/home-en-light-1440.png)
- [Arabic mobile homepage](screenshots/home-ar-light-390.png)
- [English dark homepage](screenshots/home-en-dark-1440.png)
- [Arabic dark homepage](screenshots/home-ar-dark-1440.png)
- [Syllabus desktop](screenshots/eda-en-light-1440.png)
- [Registration mobile dark](screenshots/join-en-dark-390.png)

## Verification limits

Lighthouse is a local simulated-mobile lab audit, not evidence of field Core Web Vitals or measured INP. Automated accessibility and contrast results complement keyboard and visual checks; they do not certify complete WCAG conformance. No live student mutation or hosted-auth workflow was tested. Google Drive is external: preserve its fallback link and report playback separately from successful embedding.

The production bundle still includes a JavaScript chunk above Vite's default 500 KB warning threshold. Public routes now load on demand. Removing more initial code would require a separate review of existing provider/dependency boundaries; this redesign preserves authentication behavior.

## Verified results (2026-11-02)

| Check                                              | Result                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| TypeScript, ESLint, Prettier, production build     | Passed                                                               |
| Frontend/auth/localization/preference tests        | 17 passed                                                            |
| Existing embedded database security regression     | 15 passed; test fixtures only                                        |
| Generated database types                           | Match existing catalog                                               |
| Public layout matrix                               | 160 passed: 8 routes, 2 languages, 2 themes, 320/390/768/1024/1440px |
| Browser interaction assertions                     | 38 passed                                                            |
| Text contrast samples                              | 2,256 samples across 32 route/theme/language cases; no failures      |
| Browser exceptions / local HTTP failures           | None                                                                 |
| Production boundaries / original logo preservation | Passed                                                               |
| Local mobile Lighthouse                            | Performance 99, accessibility 100, best practices 100, SEO 92        |
| Lighthouse LCP / CLS / total blocking time         | 0.9s / 0.005 / 110ms                                                 |

See [browser evidence](browser-results.json) and [Lighthouse summary](lighthouse-summary.json). Interaction coverage includes skip link and page/anchor focus, mobile focus trap and restoration, FAQ keyboard behavior, all syllabus disclosures, unchanged disabled registration, real portrait loading, social links, reduced motion, private-route boundaries, blocked storage, carousel buttons/focus/touch, live RTL switching, system theme fallback and saved-theme precedence.

The external video returned HTTP 200 and exposed a play control, but the final attempt did not establish playing media. Playback remains unverified; the original Drive fallback link is retained.
