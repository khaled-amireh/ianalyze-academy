# Frontend redesign audit

Inspected 2026-11-02 before implementation.

- Initial working tree: clean; branch `main`, commit `5bd9383`.
- Requested Zain branch found: `origin/design/zain-ui-ux-redesign`, also at `5bd9383`. Working branch: `design/ultimate-ui-ux-redesign`, based on Zain. No push, merge, infrastructure change, or deployment is authorized by the detailed brief.
- Stack: React 19, TypeScript 6, Vite 8, Tailwind 4, React Router, Radix owned UI primitives, Lucide icons, i18next.
- Routes: `/`, `/about`, `/eda`, `/videos`, `/team`, `/join`, `/leaderboard`, `/contact`, translated fallback. Development-only `/_preview/*` is gated and excluded from production.
- Architecture: public layout with shared navigation/footer; shared headings, cards, fields, reveal and content helpers; existing student/organizer/admin foundation screens are development previews.
- Brand: original iAnalyze/iTeam logos and supplied team portraits; navy `#08546f`, teal `#429eab`; Inter/Cairo local fonts; semantic CSS variables and 8-28px radius utilities.
- Existing UX: double-height utility/header, chart illustration hero, repeated bordered panels; useful syllabus accordions, focus management, skip link, accessible modal navigation, persistent locale/theme and mixed-direction text should be retained.
- Localization: complete English/Arabic JSON dictionaries; Arabic defaults; document language/direction plus Radix direction provider. Technical names use isolated LTR spans.
- Theme: light/dark semantic variables; explicit preference saved locally, pre-paint initialization in HTML. Improve surface hierarchy and system theme fallback without changing preference keys.
- Integration boundary: `src/lib/supabase*`, `academy-data.ts`, generated database types and `features/auth/*`. Auth provider subscribes to the existing store; authorization and Supabase calls remain untouched. RLS is authoritative.
- Working public features: route navigation, curriculum content/accordions, official social links, supplied portraits, Google Drive video with fallback, preferences and 404.
- Incomplete features: disabled registration preview; empty leaderboard and future badge/personal-ranking concepts. Public login, activities, submissions, grading and operational dashboards are not implemented. Do not invent data or enable these through a visual redesign.
- Validation: type check, ESLint, Node tests, Prettier, Vite build, production boundary checks; historical dependency-integrity scripts; existing isolated Chrome DevTools browser harness. Database validation exists but frontend scope does not require backend edits.
- SEO: preserve route slugs, route-based translated page titles, description and original brand assets. No analytics integration or structured data found in the inspected app shell.

## Design decision

Full presentation redesign with existing routes and behavior preserved. `DESIGN_VARIANCE=5`, `MOTION_INTENSITY=4`, `VISUAL_DENSITY=4`: calm learning product, original teal identity, neutral surfaces, readable bilingual type, one 76px desktop header, restrained entrances and an explicitly controlled curriculum carousel. Reuse Radix/Tailwind rather than introduce another component system. Cards have 16-24px corners; controls 10-12px; status labels remain compact.

## Library research

- [Motion animate](https://motion.dev/docs/animate): the mini API animates native browser styles with a smaller footprint. Selected for short content entrances, with device reduced-motion handling and content visible before initialization. [LazyMotion](https://motion.dev/docs/react-lazy-motion) was also evaluated; richer React animation features are unnecessary for this scope.
- [Embla React](https://www.embla-carousel.com/docs/v8/get-started/react): React integration with cleanup; explicit previous/next controls and RTL direction. No autoplay, no scroll hijacking.
- [Manrope](https://fontsource.org/fonts/manrope) and [IBM Plex Sans Arabic](https://fontsource.org/fonts/ibm-plex-sans-arabic): locally bundled fonts, swap rendering, limited script/weight downloads.
- Keep CSS for hover/focus feedback and native document scrolling. GSAP, WebGL and smooth-scroll interception would add complexity without helping this educational flow.

Dependency additions are scoped to frontend presentation. Existing backend contracts, original assets, historical baselines and environment/deployment files stay unchanged.
