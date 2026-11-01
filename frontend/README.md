# iAnalyze Academy · Phase 02

The bilingual public React website for iAnalyze AI & DS Club, under iTeam at Al-Zaytoonah University of Jordan. Phase 00 archives and Phase 01 documentation are preserved. Phase 02 includes eight public pages and no backend services.

## Run locally

Use Node.js 24+ and npm 11+. From the repository root:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open <http://127.0.0.1:5173/>. Dependencies are already installed in the supplied checkout; `ci` is for a fresh installation. Use `npm` in shells without the Windows PowerShell execution policy restriction. No API keys are needed.

```powershell
npm.cmd run validate       # types, lint, nine tests, formatting, build, preservation
npm.cmd run build
npm.cmd run preview        # http://127.0.0.1:4174/
```

Vite preview is for local build inspection. No deployment was configured or performed. The dependency lock and installed stack are unchanged.

## Public routes

| Route          | Content                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------ |
| `/`            | Introduction, featured EDA program, weekly journey, video resource, community, joining CTA |
| `/about`       | Club identity, iTeam relationship, mission, vision, objectives, practical learning         |
| `/eda`         | Public Draft v1.0 syllabus, expandable weekly modules, outcomes, project, schedule         |
| `/videos`      | Supplied Introduction to Data Science Google Drive embed and fallback                      |
| `/team`        | Leaders: Khaled Amireh and Yomna Al-jabiri, using the supplied original portraits          |
| `/join`        | Direct-registration explanation and disabled, nonfunctional preview                        |
| `/leaderboard` | Unassigned top three, empty ranking table, future personal ranking and badge concept       |
| `/contact`     | Official iTeam Instagram/LinkedIn links and nine accessible FAQs                           |

Unknown routes show the translated 404. Hosting in a later phase will need an SPA fallback.

## Content and components

`src/content/public-content.ts` contains typed public metadata: syllabus structure, durations, tools, profiles, video URLs, social links, FAQ IDs and planned registration fields. Copy and translations live in the existing `src/locales/{ar,en}.json` dictionaries. Edit files as UTF-8; encoding tests reject corrupted Arabic and punctuation. Profile names retain the supplied Latin spelling in both languages because Arabic name spellings were not supplied.

The source syllabus is `../docs/phase-00/student-syllabus-source.md`. No file named `student-syllabus.md` exists in this checkout. The source agrees with the Phase 02 brief on the public curriculum. The brief supplies the Draft v1.0 label and supersedes older approval-flow proposals. Keep all future syllabus revisions in the typed content and both dictionaries. No private Team Syllabus was read or copied.

`src/components/shared/academy-content.tsx` provides common program facts, weekly cards, social links, text links and joining callouts. The existing page header, section heading, reveal, field and Radix/shadcn primitives remain in use. `src/styles/public-pages.css` extends the semantic design tokens. Original logos and portraits are byte-identical to their sources; cropping uses CSS only. Fonts are local Inter/Cairo with the existing OFL notices.

## Preferences, accessibility and scope

Arabic RTL and light mode remain defaults. AR/EN, light/dark, and validated local-storage preferences retain the Phase 01 architecture. The document language/direction and Radix direction follow the locale. `MixedText` groups each phrase in one inline wrapper so bilingual content flows correctly inside flex controls. Reduced motion disables transitions, entrances and scroll reveals. Routes focus their page heading, controls have visible focus, and the mobile dialog traps/restores focus.

Registration is a disabled fieldset with no form, submission handler, persistence or request. It includes the seven planned fields and required privacy/WhatsApp consent. There are no student records, authentication, roles, uploads, grading, points calculations, database, Supabase integration or contact form. Future Leaders and Organizers are to share one Team authorization level; labels on public profiles do not grant permissions.

Development-only component/dashboard demonstrations now require `VITE_ENABLE_DEV_PREVIEWS=true` in `.env.local`. They are off by default and always excluded from production. Production preview routes resolve to 404, even if that flag is enabled at build time.

## Browser checks

The optional Phase 02 harness uses the repository's existing dependency-free Chrome DevTools testing approach, with an isolated **headless** Chrome profile and debugging port **9225**. It does not attach to a personal profile. Start `npm.cmd run preview`, launch installed Chrome, then run:

```powershell
$testProfile = Join-Path (Get-Location).Path 'artifacts\phase-02-chrome'
Start-Process -FilePath 'C:\Program Files\Google\Chrome\Application\chrome.exe' -WindowStyle Hidden -ArgumentList @('--headless=new', '--remote-debugging-port=9225', ('--user-data-dir="' + $testProfile + '"'), '--no-first-run', '--no-default-browser-check', 'about:blank')
npm.cmd run test:browser:phase-02
node scripts/phase-02-video-qa.mjs  # optional external playback diagnostic
```

Use a different Chrome executable path if needed. The harness writes only to `../docs/phase-02/`. It covers 160 route/language/theme/width combinations, keyboard interactions, persistence, disabled registration, production route boundaries, contrast samples, and the real external iframe attempt. Layout tests block Drive so network delays do not affect the matrix; the external check then unblocks it. See the review for actual playback evidence and verification limits. Previous Phase 01 QA scripts remain unchanged and retain their original output locations.

Review, screenshots, inventory and evidence: [Phase 02 review](../docs/phase-02/phase-02-review.md). No commit, push or deployment. Stop at Phase 02.
