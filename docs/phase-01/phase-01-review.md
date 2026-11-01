# Phase 01 review

Completed 31 October 2026. **Phase 01 only**: a React frontend foundation, not a finished public website or learning platform. Phase 02 has not started. No backend, authentication, live registration, file submissions, grading, rankings, Course Management, deployment, commit or push.

## Delivered

- Separate `frontend/` application: React, strict TypeScript, Vite, CSS-first Tailwind Vite integration, customized shadcn/Radix controls, React Router, Lucide and react-i18next.
- Eight public route foundations, a representative Home hero, translated 404/recovery, shared public layout and reusable dashboard layout.
- Arabic/English dictionaries, RTL/LTR, mixed technical text isolation, LTR code, persistent preferences and configurable Arabic default.
- Light-first and dark semantic palettes, prepaint preference bootstrap, original logo assets on readable white backing. No header subtitle element in either language.
- Keyboard-capable mobile navigation/dialogs/disclosures, fields, buttons, cards, badges, section headings, grids, status/loading/empty states and controlled motion.
- Explicit local-development gallery and three role shells, excluded from production JavaScript and routes. All figures are empty dashes; no students or internal documents appear.
- Local font/license reuse, npm lock, ESLint, Prettier, lightweight tests, build/privacy/preservation checks, browser results, screenshots and developer documentation.

## Run

From the repository root:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Local development URL: <http://127.0.0.1:5173/>. Temporary development/production preview servers and the isolated QA browser were stopped after verification. Run the commands above to reopen the app. The application needs a local server; opening `index.html` as a file is not supported by Vite. Use `npm.cmd run validate` for the standard checks and `npm.cmd run preview` for local production inspection at <http://127.0.0.1:4174/> after a build. See [the frontend README](../../frontend/README.md) for structure, defaults and optional browser-test setup.

## Executed checks

| Check | Actual result |
| --- | --- |
| Dependency installation and current official setup | Completed successfully with npm; official Vite/Tailwind/shadcn instructions followed |
| Development server | Started at 127.0.0.1:5173; all tested route URLs rendered |
| Strict TypeScript | Passed |
| ESLint | Passed |
| Prettier | Passed |
| Node tests | 7 passed: preferences, blocked storage, production/development translation parity, mixed-language punctuation and numeric-range isolation |
| Production build | Passed; local Vite preview started at 127.0.0.1:4174 |
| Production bundle boundary | No development route/fixture marker, fixture text, private syllabus file or lazy preview chunk found |
| Phase 00 preservation | All 122 recorded files match their original SHA-256 hashes |
| Logo integrity | Both copied PNGs byte-identical to the Phase 00 source files |
| Responsive/i18n/theme matrix | 260 combinations passed: 13 routes × 5 widths × 2 languages × 2 themes |
| Required widths | 320, 390, 768, 1024 and 1440 CSS px; zero document overflow |
| Bilingual rendering | Correct lang/dir/theme; one h1, no unresolved fixture labels, broken images or unlabeled controls; code remains LTR |
| Menu/dialog keyboard | Enter opens, focus stays inside, Escape closes/restores focus; menu link navigates and focuses the destination heading |
| Language/theme persistence | Switcher preserves route; reload restores preferences; blocked browser storage still renders/switches safely |
| Initial keyboard entry | First Tab reaches the visible skip link |
| Accordion keyboard | Enter expands; localized content available |
| Reduced motion | No active animations; button transition durations become zero |
| Standard motion | Transitions enabled; hero entrance settles to fully visible content |
| Color contrast | 20 semantic pairs pass their 4.5:1 text / 3:1 boundary thresholds; actual primary buttons measured 8.37:1 light and 9.05:1 dark |
| Development browser console/network | Zero runtime exceptions, console errors, failed requests or external requests in the recorded run |
| Production routes | 14 checks passed across both languages: four preview URLs and three future private-role URLs show 404; no fixture or development link |
| Production preferences/navigation | All 5 additional checks passed, including blocked localStorage and skip-link keyboard entry |
| Runtime dependency audit | 0 npm advisories reported with `--omit=dev` |
| Full dependency audit | 17 tooling advisories remain: 2 low, 15 moderate; compatible `npm audit fix` made no further changes |

Browser: Chrome 156.0.8078.74, headless, native DevTools Protocol, device scale factor 1. The matrix uses reduced motion for stable captures; standard motion was tested separately. Viewports emulate layout widths, not physical-device testing. Results: [development JSON](browser-results.json), [production JSON](production-browser-results.json), [runtime audit](production-dependency-audit.json), [full audit](dependency-audit.json).

The initial screenshot review caught primary-link foreground inheritance overriding the button token. It was corrected, and actual rendered button contrast checks were added and passed. The Arabic notebook note was also corrected to keep the complete English phrase (including its comma) in one LTR run, with regression tests. Test-harness selector issues were corrected before the successful recorded runs. No failed attempt is presented as a passing result.

## Visual comparison with Phase 00

The current static renderer remains the approved reference, including the later deletion of the header caption. Archived refinement screenshots predate that deletion; they are retained as history and were not overwritten. The React Home preserves its broad two-column composition, large navy heading, calm cool canvas, illustrative bar/line board, notebook annotation and program-fact strip. Original typography, colors, proportions and parent branding carry forward.

Intentional differences:

- The old preview toolbar becomes a compact Academy utility row with language/theme controls. The logo-only header has a shorter, balanced footprint and no space reserved for a caption.
- Navigation has a tinted active state and short underline transition. Mobile uses a modal drawer with focus containment rather than exposing desktop links in the narrow header.
- The Home foundation stops after the hero/facts and clearly states its scope. Full EDA promotion, benefits, community sections and real application content remain Phase 02.
- Seven public routes share consistent page headers and useful empty states. They are foundations, not a claim that full content has been implemented.
- Role shells have reusable navigation and empty panels instead of the Phase 00 mock grades, profiles and sample statistics.
- Dark mode is new: quiet charcoal-blue surfaces, pale teal actions and white logo frames preserve recognition.
- Components have consistent 44px targets, rounded borders, clearer states and limited motion. Reduced-motion captures show the board unrotated, intentionally.

Reference: [archived approved Home design](../phase-00/refinement/after/home-en-1440.png), [current static preview](../../design-preview/index.html). Compare it with [React Home, English](screenshots/home-en-light-desktop.png) and [React Home, Arabic](screenshots/home-ar-light-desktop.png).

## Screenshots and reviewed views

| View | Evidence |
| --- | --- |
| Home / English / light / desktop | [Screenshot](screenshots/home-en-light-desktop.png) |
| Home / Arabic / light / desktop | [Screenshot](screenshots/home-ar-light-desktop.png) |
| Home / English / dark / desktop | [Screenshot](screenshots/home-en-dark-desktop.png) |
| Home / Arabic / dark / mobile | [Screenshot](screenshots/home-ar-dark-mobile.png) |
| Home / English / light / mobile | [Screenshot](screenshots/home-en-light-mobile.png) |
| EDA foundation / Arabic / desktop | [Screenshot](screenshots/eda-ar-light-desktop.png) |
| Component gallery / English / desktop | [Screenshot](screenshots/components-en-light.png) |
| Component gallery / Arabic / dark / mobile | [Screenshot](screenshots/components-ar-dark-mobile.png) |
| Student shell / Arabic / desktop | [Screenshot](screenshots/student-ar-light.png) |
| Organizer shell / English / dark / desktop | [Screenshot](screenshots/organizer-en-dark.png) |
| Admin shell / English / desktop | [Screenshot](screenshots/admin-en-light.png) |
| Student shell / Arabic / 320px | [Screenshot](screenshots/student-ar-mobile.png) |

The Home, Arabic dark mobile, component gallery and student shell were visually inspected after capture. All other routes were checked through the recorded layout matrix. This is not a claim of manual visual inspection of every one of 260 combinations.

## Remaining limits and decisions

- Screen-reader usability, Firefox/Safari, physical devices, real browser zoom and a complete WCAG audit were not executed. Automated labels/contrast/keyboard checks do not certify conformance. Deliberate ErrorBoundary failure injection was not tested.
- The original transparent logos are high enough resolution; no replacement is needed. Original PNGs and full local fonts total roughly 3MB before compression. Review lossless/font optimization later, keeping original sources intact.
- Tooling advisories involve minimatch/deepmerge and their development dependency chains. npm's remaining suggested fixes require incompatible forced changes or have no supported fix; none were forced. Recheck before processing untrusted build/registry inputs. Runtime packages have no reported advisories in the recorded audit.
- Arabic/light defaults are configurable. The project owner should review dark palette, responsive spacing, wording and route foundations before Phase 02.
- Real team profiles/photos, approved videos/URLs, contact channels, final registration/privacy fields and start/venue details are still required. No replacements were invented. Draft v1.0 curriculum may change; no private syllabus is bundled.
- Authentication and backend authorization are absent by scope. Production role URLs intentionally show 404. No future role is inferred from client preferences or navigation.

## Handoff

[Repository audit](repository-audit.md), [architecture decisions](architecture.md), [complete changed-file inventory](file-inventory.md), and the frontend README describe the implementation. Only the root README was modified outside the new `frontend/` and `docs/phase-01/` trees; its original description is preserved. Phase 00 remains unchanged.

Recommended next action: owner review and approval of this foundation. After approval, Phase 02 can replace public placeholders with approved content, while keeping private-role interfaces development-only until authentication/authorization work. **Stop here; do not start Phase 02 without approval.**
