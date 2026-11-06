<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="frontend/src/assets/brand/ianalyze-on-dark.png">
    <img src="frontend/src/assets/brand/ianalyze-on-light.png" alt="iAnalyze Academy — AI & DS Club, an iTEAM initiative" width="420">
  </picture>
</p>

# iAnalyze Academy

A bilingual learning platform for aspiring data analysts, built as an iAnalyze initiative under iTEAM at Al-Zaytoonah University of Jordan.

**[🌐 Visit Live Website](https://ianalyze-academy.pages.dev/)** · [GitHub Repository](https://github.com/khaled-amireh/ianalyze-academy)

## About the project

iAnalyze Academy helps students explore data analysis through accessible learning resources, structured guidance, and a collaborative academic community. It brings together the educational work of iAnalyze, an initiative under iTEAM at Al-Zaytoonah University of Jordan, in one bilingual platform.

## Key features

### Public learning experience

- **Arabic and English:** translated content with RTL/LTR text handling. The approved layout keeps its RTL structure across languages while English text reads left to right.
- **Responsive design and themes:** mobile-friendly layouts, light/dark themes, and saved language and theme preferences.
- **EDA learning resources:** course information, preparation guidance, and study-plan content for Exploratory Data Analysis. The detailed week-by-week plan is implemented but currently hidden on the public course page.
- **AI Tools Hub:** beginner-friendly guides for Google Colab, Python, Visual Studio Code, Kaggle, and Power BI, with official setup and documentation links.
- **Educational Video Library:** an introductory data science video and a Kaggle tutorial, with embedded playback and direct viewing links.

### Accounts and learning workspace

The following capabilities are implemented and depend on a configured Supabase backend, verified identity, role permissions, and applicable release gates:

- **Registration and authentication:** email verification, sign-in, recovery/reset flows, and optional persistent sessions. Signup requires both registration and privacy approval; production builds require a fresh owner-readiness check before enabling registration.
- **Student and Team dashboards:** students access released learning content and their own learning records; authorized Team members manage activities, rubrics, grading, and announcements. Leaders and Organizers share the Team authorization role.
- **Profiles and notifications:** private profile viewing/editing, bilingual announcements, learning notifications, and persistent read receipts. Notifications refresh in the app; they are not browser push notifications.
- **Weekly activities and submissions:** activity publication, deadlines, rubric-based assessment, and a validated notebook submission workflow. **Production submissions and uploads remain disabled** by frontend and server-side gates; their implementation does not make uploads publicly available.
- **Leaderboard:** ranking functionality and a public placeholder are implemented. **Live rankings remain disabled in production**; an empty podium does not represent active student scores.

Public About and Contact pages connect learners with the academic team and official iTEAM community channels. They do not provide an in-app chat or discussion forum.

Availability follows the approved release configuration, not the presence of a route or component. The production build keeps submission and leaderboard flags off; account access additionally depends on backend policies and registration approval.

### Motion and accessibility

Lightweight public-page transitions use the original official iTEAM logo with the approved 800ms timing. Reduced-motion preferences are respected, and authentication/protected navigation remains immediate. The interface also provides keyboard focus handling and accessible navigation controls.

## Technology stack

| Area                 | Technologies                                                                       |
| -------------------- | ---------------------------------------------------------------------------------- |
| Application          | React 19, TypeScript 6, Vite 8, React Router 8                                     |
| Styling and UI       | Tailwind CSS 4, Radix UI primitives, Lucide icons, Motion, Embla Carousel          |
| Localization         | i18next and react-i18next                                                          |
| Backend              | Supabase Auth, PostgreSQL with row-level security, Storage, and Edge Functions     |
| Hosting and delivery | Cloudflare Pages and GitHub Actions                                                |
| Quality checks       | ESLint, Prettier, Node.js tests, and PGlite for embedded PostgreSQL security tests |

Dependency versions and commands are defined in [frontend/package.json](frontend/package.json); installation uses the committed lockfile.

## Getting started

Use **Node.js >=24.0.0** and **npm >=11.0.0**, as required by the frontend package.

```sh
git clone https://github.com/khaled-amireh/ianalyze-academy.git
cd ianalyze-academy/frontend
npm ci
npm run dev
```

Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/). Public learning pages can run without backend credentials. In Windows PowerShell environments that block npm scripts, use `npm.cmd` in place of `npm`.

### Backend-dependent features

Use [frontend/.env.example](frontend/.env.example) as the reference for an ignored local environment file. Accounts, dashboards, profiles, notifications, and learning records require an appropriately configured Supabase project and schema. Browser configuration accepts a Supabase URL and a **browser-safe publishable key**; privileged keys never belong in frontend variables or committed files.

Keep the example's release flags closed unless intentionally testing the corresponding capability. Frontend flags alone do not grant roles or open database/Storage permissions. Docker and the local Supabase services are needed for full local backend testing; the [local backend runbook](docs/supabase-auth-integration/README.md) describes stack preparation, captured email, and integration commands. Its older release notes are historical snapshots.

### Validate and build

Run these commands from `frontend/`:

```sh
npm run validate
npm run build
npm run preview
```

Validation covers types, lint, tests, formatting, the public artifact, preservation rules, embedded database security, and database types. Preview serves the build at [http://127.0.0.1:4174/](http://127.0.0.1:4174/); it does not deploy anything.

For a public-only build that excludes local backend configuration and development previews, use:

```sh
npm run build:public
npm run check:pages
```
