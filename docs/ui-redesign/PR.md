# Redesign the bilingual Academy frontend with restrained motion

The public frontend had a tall two-part header, a sample-chart hero and repeated boxed sections. This redesign presents the actual curriculum first, adds a touch-friendly weekly-module carousel, and gives all public pages consistent typography, spacing, focus feedback and light/dark surfaces.

Uses Motion's mini API, Embla, and locally bundled Manrope / IBM Plex Sans Arabic. Public routes load on demand, original logos have smaller display derivatives, and Arabic switching updates RTL layout and carousel direction. Route and anchor navigation preserve keyboard focus, including the skip link. Original route slugs, source assets, content contracts, consent and integration boundaries are preserved. Registration and leaderboard remain explicit incomplete states.

Validation: production build, type check, lint, formatting, 17 frontend tests, 15 existing embedded security tests, generated-type and preservation checks passed. Isolated Chrome passed 160 layout cases and 38 interaction assertions with no contrast failures, browser exceptions or failed local requests. Local mobile Lighthouse: performance 99, accessibility 100, best practices 100, SEO 92; LCP 0.9s and CLS 0.005. Scores are local lab measurements. Existing preview fallback at `/robots.txt` accounts for the SEO issue. Drive playback remains unverified despite a successful embed response.

Review [screenshots and full verification notes](README.md). Backend, authentication/authorization, environment and deployment files are unchanged. No production deployment is included.
