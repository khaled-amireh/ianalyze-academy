# PR #8 — public learning resources

Review branch: `codex/navbar-footer-refinement`. Implementation baseline: `2707406`.
No merge, deployment, backend change, or dependency installation is part of this work.

## Behavior

- `/ai-tools` presents exactly five tools: Google Colab, Python, Visual Studio Code, Kaggle, and Power BI Desktop.
- `/ai-tools/google-colab`, `/ai-tools/python`, `/ai-tools/vscode`, `/ai-tools/kaggle`, and `/ai-tools/power-bi` provide concise bilingual guides, numbered steps, verification examples, official links, and a back link.
- Colab is the course tool. Python and VS Code are optional local setups, Kaggle supports dataset practice, and Power BI Desktop is an optional Windows application. Local installation is not required for the Colab-based EDA course.
- `/videos` activates the existing VideosPage with exactly two Drive embeds, accessible titles, 16:9 players, visible fallback help/buttons, and the supplied YouTube attribution for the second entry.
- `/eda` updates only the What You Need card and the lower resources area. It links to the Tools Hub and previews both videos with links to `/videos#data-science` and `/videos#kaggle`. The course title, description, schedule, facts, audience card, registration section, curriculum data, and `SHOW_WEEKLY_PLAN = false` remain intact.
- Navbar, mobile menu, Footer, and browser titles include the new public pages. The existing menu is used below 1280px; desktop labels can wrap for longer registration-completion controls. Logo sizing and authentication behavior are unchanged.
- New resource grids retain their arrangement across languages. Text alone uses Arabic RTL/right alignment or English LTR/left alignment. No global direction, palette, typography, or approved About card changes were made.

## Changed files

```text
frontend/src/app/app.tsx
frontend/src/app/navigation.ts
frontend/src/app/route-effects.tsx
frontend/src/components/layout/footer.tsx
frontend/src/components/layout/mobile-navigation.tsx
frontend/src/components/shared/learning-video.tsx
frontend/src/content/learning-tools.ts
frontend/src/content/public-content.ts
frontend/src/content/video-resources.ts
frontend/src/index.css
frontend/src/locales/ar.json
frontend/src/locales/en.json
frontend/src/pages/public/ai-tools-page.tsx
frontend/src/pages/public/tool-guide-page.tsx
frontend/src/pages/public/syllabus-page.tsx
frontend/src/pages/public/videos-page.tsx
frontend/src/styles/learning-resources.css
frontend/src/styles/navigation-footer.css
frontend/tests/learning-resources.test.ts
docs/final-improvements/approved-changes.json
docs/pr-8-learning-resources.md
```

The preservation manifest pins the exact authorized frontend changes, including the existing PR #8 refinements. Historical baselines, protected backend/auth files, and the preservation checker itself are unchanged.

## Verification

The following commands passed in `frontend`:

```text
npm run check:types
npm run lint
npm test
npm run format:check
npm run build
npm run check:production
npm run check:pages
npm run check:phase-02
npm run check:redesign
npm run check:phase-03
```

The 49 unit tests include official tool destinations, complete guide translations/steps, both Drive IDs/fallback URLs, branding preservation, and existing authentication/content regressions.

Isolated local browser testing covered all eight resource routes in Arabic and English, light and dark, at 375, 390, 768, 1024, and 1440px (160 cases). It checked content, routes, official links, safe external links, video markup/aspect ratio, EDA preservation, text direction, and overflow. Additional checks covered 30 guest/student/team navigation combinations, 70 navigation states including incomplete registration around the desktop breakpoint, 40 numbered-guide/keyboard-focus cases, and guide/back/View Tools interactions. Tool card order and horizontal positions were identical across languages. No hosted account or student data was used. Screenshots and temporary browser harnesses remain in ignored local artifacts.

## External video observations — 2026-11-06

Both supplied Drive embeds were loaded in the actual application at `http://localhost:5174/videos` using a fresh logged-out Chrome profile. Both preview documents returned HTTP 200 and exposed a play control. No sharing-denied message was observed.

- Original introduction (`147puYxGioHyoYjSwxktgGP4RRWeM_qn4`): playback was attempted twice. The media remained at `currentTime = 0`, `readyState = 0`, and timed out, including an attempt allowing 12 seconds to start plus 5 seconds to observe. Successful playback is **not verified**. This test does not establish whether the cause is the external media, browser, or network.
- Supplied Kaggle file (`1Qh5BPaoR125I00znXsaCF6e1s5HpuPBS`): muted playback advanced beyond six seconds (`readyState = 4`, video width 640). However, Drive identifies it as `iAnalyze Introduction to Data Science.mp4`, and the opening slide reads “Intro to Data Science & Data Analysis.” The file needs owner review to confirm that it is the intended Kaggle tutorial. The supplied ID, website label, and YouTube reference were retained as requested.

Drive files and sharing permissions were not changed. The website always offers the correct corresponding **Open in Google Drive** button; it does not claim to detect cross-origin playback failures.

## Official references used for guide accuracy

- [Colab FAQ](https://research.google.com/colaboratory/faq.html)
- [Python on Windows](https://docs.python.org/3/using/windows.html), [macOS](https://docs.python.org/3/using/mac.html), and [Linux/Unix](https://docs.python.org/3/using/unix.html)
- [Python in VS Code](https://code.visualstudio.com/docs/python/python-tutorial), [Windows setup](https://code.visualstudio.com/docs/setup/windows), [macOS setup](https://code.visualstudio.com/docs/setup/mac), and [Linux setup](https://code.visualstudio.com/docs/setup/linux)
- [Kaggle notebooks](https://www.kaggle.com/docs/notebooks)
- [Microsoft Power BI Desktop installation and requirements](https://learn.microsoft.com/en-us/power-bi/fundamentals/desktop-get-the-desktop)

## Local review

The updated preview is left running at `http://localhost:5174/`. Open `/ai-tools`, each View Guide button, `/videos`, and `/eda`. Use the existing language and theme controls; use the mobile menu at smaller widths. This preview has Supabase disabled, so its Log in navigation is hidden by the existing unconfigured-backend behavior. Guest/account controls were separately checked with local mocked states.

The previously requested server on port 5173 was left running. Port 5174 uses its own dependency cache so it can preview the updated source independently.
