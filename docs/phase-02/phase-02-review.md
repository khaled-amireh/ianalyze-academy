# iAnalyze Academy — Phase 02 review

Completed implementation on 1 November 2026. All eight public pages are built in the existing `frontend/` React application. Arabic/English, RTL/LTR, light/dark mode, persisted preferences, original branding, and the existing motion foundations remain in use. Registration and rankings are honest future-facing previews. No backend, authentication, deployment, commit, push, or Phase 03 work was performed.

## Delivered experience

| Route          | Phase 02 result                                                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`            | Branded hero with Join and Syllabus CTAs; club introduction; featured EDA program; six weekly cards; introductory video resource; collaborative community; registration callout; public footer                      |
| `/about`       | Who we are; relationship with iTeam; mission; vision; learning objectives; learning by doing; student community; factual mention of earlier Data Science and Power BI training                                      |
| `/eda`         | Public Draft v1.0 syllabus; overview; five learning objectives; audience and prerequisites; six expandable modules; optional weeks 07–08; outcomes; methodology; team mini project; Thursday schedule; joining CTA  |
| `/videos`      | Supplied Introduction to Data Science iframe; responsive 16:9 frame; lazy loading; accessible title; fullscreen permission; visible Google Drive fallback; clear distinction from the current EDA course            |
| `/team`        | “Leaders” page with exactly Khaled Amireh and Yomna Al-jabiri; Member labels; AI Student — 4th Year; original photographs; matching cards and CSS cropping                                                          |
| `/join`        | Registration Coming Soon; explanation of future direct registration without approval; disabled preview of all seven planned fields and required consent; private WhatsApp use explained; no form or data collection |
| `/leaderboard` | Three unassigned positions; empty ranking table; approved-grades-only explanation; personal ranking concept; privacy-friendly alias explanation; future badge placeholder with no invented awards                   |
| `/contact`     | Recognizable Instagram/LinkedIn marks; exact supplied official iTeam account URLs; safe new-tab links; nine bilingual Radix FAQ accordions                                                                          |

Modern Academy styling extends the existing semantic palette in `src/styles/public-pages.css`. The pages reuse the original header, page/section headings, fields, controls, reveal utility, fonts, and preference providers. Layouts use responsive grids, measured card spacing, restrained accents, hover/press feedback and reduced-motion support. No animation package, remote font, paid service or new dependency was added.

## Content sources and decisions

1. **Syllabus filename discrepancy:** the brief refers to `student-syllabus.md`; it does not exist in the supplied checkout. The available public source is [student-syllabus-source.md](../phase-00/student-syllabus-source.md). It was read without modification and matches the brief's curriculum, schedule, tools and prerequisites. The Phase 02 brief supplies the Draft v1.0 label. No conflicting public module sequence was found.
2. **Current public course:** six teaching weeks, 18 planned teaching hours, two optional buffer/support weeks; Thursday 10:00 AM–1:00 PM; no previous Python experience; Arabic explanations with English technical terms. Start date and location remain unannounced. A laptop and Google account are recommended, rather than made into an invented attendance requirement.
3. **Earlier workflow proposals:** archived documents contain older application/approval concepts. The current brief explicitly supersedes them with direct student registration after authentication. Earlier documents remain preserved; the public site does not implement Pending/Accepted/Rejected applications.
4. **Team authorization plan:** future Leaders and Organizers share one Team authorization level for registered students, private WhatsApp numbers, activities, submissions, grading/feedback, announcements and the private Team Syllabus. Public “Member” profile labels are separate from permissions. Actual authorization belongs to later backend phases.
5. **Portraits and names:** supplied WebP files were copied byte for byte into `frontend/src/assets/team/`. Only CSS crops the displayed view. Both use the same card/photo aspect ratio; Yomna's wider original is framed slightly closer. Names retain the exact supplied Latin spelling in both locales because Arabic name spellings were not supplied. No biographies or extra members were invented.
6. **Media and contacts:** the exact supplied Drive ID and account URLs are centralized. The video is streamed by the third-party embed; it was not downloaded into the repository or moved to another host. Social account destinations were checked against the supplied URLs; no contact email or additional account was invented.
7. **Local previews:** dashboard/component demonstrations are off by default and require an explicit local environment flag. Production builds still exclude their routes, modules, fixture translations and links. No private Team Syllabus was read, copied or exposed.

## Content architecture

- `src/content/public-content.ts`: typed public syllabus metadata/module IDs, program counts, tools, profile/image metadata, video URLs, social URLs, FAQ IDs and registration fields.
- `src/locales/ar.json` and `en.json`: all public copy, weekly descriptions, FAQs, consent wording, accessible names and empty states, using the existing i18next architecture.
- `src/components/shared/academy-content.tsx`: reusable program facts, weekly cards, text links, social links/cards and registration callouts.
- `src/components/shared/social-icons.tsx`: small local SVG social marks; no tracking script or remote icon dependency.
- `src/pages/public/`: dedicated Home, About, Syllabus, Videos, Team, Join, Leaderboard and Contact components. The seven obsolete foundation placeholders were replaced, and their unused module was removed.

The new Unicode tests address an encoding issue caught during screenshot review. Both translation dictionaries now preserve UTF-8 Arabic and punctuation. A single inline wrapper in `MixedText` keeps bilingual phrases together inside flex controls and FAQ triggers. The mobile dialog explicitly declares its modal state while retaining Radix focus trapping and restoration.

Vite's development watcher excludes `artifacts/` so the isolated Chrome test profile cannot produce locked-cache-file watch errors. The temporary browser profile and owned preview servers were cleaned up after verification.

## Actual validation

Evidence: [validation log](validation-run.txt), [browser results](browser-results.json), [external video check](video-results.json), [asset hashes](asset-provenance.json), [preservation baseline](preserved-files.json), [file-change inventory](file-change-inventory.md).

| Check                    | Executed result                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript               | Passed `npm.cmd run check:types`                                                                                                                                                                                                                                                                                                                                                 |
| ESLint                   | Passed `npm.cmd run lint`                                                                                                                                                                                                                                                                                                                                                        |
| Unit tests               | 9 passed: all 7 existing tests plus 2 Unicode/Arabic-content regression checks                                                                                                                                                                                                                                                                                                   |
| Formatting               | Passed `npm.cmd run format:check`                                                                                                                                                                                                                                                                                                                                                |
| Production build         | Passed `npm.cmd run build` with the existing Vite/React stack                                                                                                                                                                                                                                                                                                                    |
| Production boundary      | Passed across 11 emitted files; development/private markers and preview assets absent                                                                                                                                                                                                                                                                                            |
| Phase 00 preservation    | All 122 files covered by the existing Phase 01 preservation manifest unchanged                                                                                                                                                                                                                                                                                                   |
| Broader preservation     | All 152 prior files in Phase 00, Phase 01 documentation, static previews, root README and tools unchanged                                                                                                                                                                                                                                                                        |
| Brand and profile assets | Both logos and both supplied portraits byte-identical to their original sources                                                                                                                                                                                                                                                                                                  |
| Dependencies             | Lock unchanged; no new dependency or paid integration                                                                                                                                                                                                                                                                                                                            |
| Responsive matrix        | 160 cases passed: 8 routes × 2 languages × 2 themes × 5 widths (320, 390, 768, 1024, 1440)                                                                                                                                                                                                                                                                                       |
| Route/layout assertions  | Correct language/direction/theme; one H1; no document horizontal overflow; image alt text; no broken loaded images; no missing translation keys; safe external link attributes; no forms; no production preview links                                                                                                                                                            |
| Keyboard/preferences     | 30 interaction assertions passed: defaults, persistence, blocked-storage fallback, route heading focus, skip link/focus ring, menu keyboard opening, focus containment, Escape restoration, mobile navigation, FAQ toggles/arrow navigation, syllabus expansion, registration privacy/disabled controls, original portraits, social links, motion, and production 404 boundaries |
| Contrast                 | 2,342 visible text samples across 32 desktop page/language/theme cases met their computed 4.5:1 normal or 3:1 large-text thresholds                                                                                                                                                                                                                                              |
| Runtime/assets           | No runtime exceptions and no failed local HTTP asset responses in the browser suite                                                                                                                                                                                                                                                                                              |
| Iframe integration       | Exact supplied URL, accessible title, `loading="lazy"`, `allowFullScreen`, safe fallback and 16:9 sizing verified; Drive preview returned HTTP 200 and rendered the real video poster                                                                                                                                                                                            |

Commands were run on Node 24.19.0/npm 11.17.0. The browser matrix used an isolated installed headless Chrome profile against the production preview at `http://127.0.0.1:4174/`. Drive was deliberately blocked during the layout matrix so third-party latency could not alter local page results, then unblocked for the actual embed test. Scaled portrait pixels are intentionally clipped within the image container; their transformed raw bounds do not create document overflow.

## Video and verification limits

The supplied Google Drive embed returned HTTP 200 and displayed the real recording's poster without signing in. The layout and fullscreen permission contract passed. An exploratory muted media-element test advanced playback to approximately 2.41 seconds, with `paused=false`; a subsequent fresh-load automation attempt timed out while initializing the nested Google player. [video-results.json](video-results.json) records that failed repeat, rather than labeling it a pass. Reliable normal playback, audio and entering/exiting fullscreen still need a manual check in a regular browser. The visible Drive fallback remains available in both languages.

The interactive browser/computer-use bridge was unavailable, so the repository's established isolated headless Chrome approach was used for screenshots and automation. The first sandboxed Chrome launch could not start its GPU process; a reviewed launch of the installed browser outside that execution sandbox succeeded without disabling Chrome security protections. No personal browser profile was used.

These checks are not a full WCAG certification. Manual screen-reader use, physical touch devices, audible media, Safari/Firefox and a live deployed environment were not tested. External Google/Instagram/LinkedIn service behavior is outside this frontend. No deployment was requested or performed.

## Screenshots and visual review

Open the [screenshot gallery](screenshots/index.html). It includes all eight pages in English desktop/light and Arabic mobile/light, dark Home in both languages, dark mobile Join in both languages, and external-player captures. Four contact sheets support page-by-page review. Representative originals:

- [Home — English desktop](screenshots/home-en-light-1440.png)
- [Home — Arabic mobile](screenshots/home-ar-light-390.png)
- [Home — Arabic dark desktop](screenshots/home-ar-dark-1440.png)
- [EDA — English desktop](screenshots/eda-en-light-1440.png)
- [Leaders — English desktop](screenshots/team-en-light-1440.png)
- [Join — Arabic mobile](screenshots/join-ar-light-390.png)
- [Contact & FAQ — Arabic mobile](screenshots/contact-ar-light-390.png)
- [Actual Drive poster](screenshots/video-embed-attempt.png)

Visual review covered hierarchy, spacing, original logo backing, portrait framing, Arabic mixed text, course cards, syllabus rows, disabled registration, empty rankings, footer links and dark surfaces. Issues found during review were corrected and rechecked; the remaining external playback uncertainty is documented above.

## Boundaries and next decisions

No backend, authentication, real registration, personal data, WhatsApp automation, uploads, grades, scoring, database, Course Management, invented statistics/testimonials, Previous Events gallery or contact email was added. No Phase 00 deliverable or Phase 01 documentation was changed. Existing unrelated root changes remain as they were. No Git commit, push or deployment occurred.

Future decisions are the official course start date/location, registration opening date and final privacy wording, any approved Arabic name spellings, activity instructions/rubrics, achievement criteria and scoring rules. Authentication/authorization is Phase 03; functional direct registration is Phase 04. Neither was started.

## Local run

From the repository root:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Development URL: **http://127.0.0.1:5173/**. The supplied checkout already has dependencies; `npm.cmd ci` is needed for a fresh installation. Run `npm.cmd run validate` for checks. Optional production preview: `npm.cmd run preview` at **http://127.0.0.1:4174/**. See [frontend README](../../frontend/README.md) for the isolated browser test setup.
