# Frontend foundation decisions

The app is isolated in `frontend/`, preserving Phase 00. It supplies route scaffolds, reusable layouts/controls and presentation preferences. The twelve complete static designs are not ported into production pages: detailed public content belongs to Phase 02.

## Rendering and routing

One BrowserRouter owns public routes. PublicLayout provides the skip link, utility controls, logo-only header, responsive navigation and footer. A representative Home hero demonstrates the approved identity. PageFoundation supplies seven localized titles/intents and honest placeholders. NotFoundPage and ErrorBoundary offer translated recovery. RouteEffects changes the title and focuses the page heading on navigation.

Direction.Provider follows locale for Radix interaction and logical placement. Arabic defaults to RTL; English to LTR. The switcher does not remount a separate website or replace the route. Initial HTML preferences apply before React starts; providers use the same validated defaults. Storage failures never block rendering.

DashboardShell accepts translated navigation/content and contains no private input. Role entry points belong exclusively to the development import graph. A compile-time DEV gate excludes the lazy preview module, dictionaries and links from production. Build inspection checks markers, paths, names and fixture text. This boundary is not authentication; no operational private routes exist yet.

## Design, motion and integration

Approved white/cool-canvas surfaces, navy hierarchy, teal details, orange annotation, soft borders, original logos and Cairo/Inter carry forward. Dark mode adds blue-charcoal surfaces and accessible pale teal actions. Logos retain white backing, proportions and original bytes. There is no subtitle node below the header logo.

Semantic CSS tokens drive Tailwind utilities and academy compositions. Customized shadcn components retain Radix semantics while improving brand styling, target sizes and localization. Reusable fields expose label/hint/error wiring without a submission service.

Motion uses CSS and native Web Animations. Effects are bounded and disabled for reduced motion. Reveal does not hide content until an observer fires; focus cancels it. Disclosure expansion follows its control's purpose. No parallax or heavy motion dependency.

No environment secret, backend SDK, database, API abstraction, role service or pretend authorization guard is present. Future authentication must distinguish account identity from club application approval, assign roles securely, and enforce resource access on the backend/database. Private documents, submitted files and grades must never become public imports.

The Team Syllabus was not read, copied or used as fixture content. The public Student Syllabus informed the fixed program's three factual indicators. Detailed curriculum, team profiles, videos, contacts, applications, points and achievements await later phases and approved content.

## Tradeoffs

- TypeScript 6.0 is compatible with the installed ESLint adapter; TypeScript 7 currently is not.
- Original PNGs and full bundled fonts preserve approved assets/licenses but add roughly 3MB of uncompressed transfer. Future asset optimization requires visual review. The 2172×724 transparent logo sources are adequate; no replacement is needed.
- Direct URLs need an SPA fallback when hosting is introduced; no hosting/deployment configuration is included.
- Dark mode extends the light-first reference without modifying artwork.
- Dashboard shells use dashes and explicit empty states rather than invented students or statistics. No LMS workflow is implemented.
