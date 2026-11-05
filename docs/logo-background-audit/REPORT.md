# Global logo background audit

Date: 4 November 2026 (Asia/Amman).

The only application change is `<ParentLogo transparent />` in the shared footer. This selects the existing approved `iteam-logo-transparent-ready.png` in light mode, matching the existing dark-mode and About-card selection. No artwork, dimensions, positioning, CSS, authentication, Supabase configuration or student data changed.

## Placement inventory and findings

| Placement | Coverage established from source | Finding and action |
| --- | --- | --- |
| Navbar, including mobile header | `Navbar` in the single `PublicLayout` around every route | Both iAnalyze theme variants have transparent alpha channels. Existing transparent wrapper override retained. No change. |
| Footer | Every route uses `PublicLayout`: Home, About, Our Team, join/registration, login, password recovery/callback/reset, privacy, leaderboard, contact, profile/edit, notifications, Student, Team workspace, development previews and not-found routes | Light-mode asset `iteam-logo-light.png` is completely opaque (alpha 255 everywhere), including white corners. Replaced its selection using the existing `transparent` prop. Dark mode already selects the approved transparent asset. |
| About iTeam card | `ParentLogo transparent` in `about-page.tsx` | Already selects the approved transparent asset in both themes. The intentional card background is retained. |
| Mobile navigation dialog | Shared `MobileNavigation` | No additional logo image. Uses the shared header logo outside the dialog. |
| Authenticated page bodies | Profile, notifications, Student and Team workspace components | No separate logo images or CSS logo backgrounds. Inherit navbar/footer from `PublicLayout`. |
| Homepage and other public page bodies | All public page source, image imports and CSS audited | No additional logo placement beyond the shared shell and About card. Team portraits are not logos. |
| HTML preloads | `index.html` | Preloads the existing transparent iAnalyze variants; no independent rendered placement. |

The footer fix is independent of locale and viewport. The existing parent-logo dimensions, aspect ratio, object-fit, theme switching and responsive rules are unchanged. The old white wrapper declarations in `academy.css` are already overridden by the later transparent declarations in `redesign.css`; they are not the confirmed cause.

## Artwork protection

All 12 existing logo PNGs in the repository were hashed before changes, compared again afterward, and compared directly against the original Git blobs. Every file is byte-for-byte identical. [Asset evidence](assets.json) records SHA-256, original dimensions, alpha range, corner pixels and transparent-pixel percentage. Images were only read for analysis; none were rewritten, copied into replacement artwork, renamed, moved, converted or deleted.

## Verification limits

`npm run validate` passed: TypeScript, lint, all 44 unit tests, formatting, the public production build, Pages artifact checks, historical preservation checks, all 32 embedded database tests and generated database type consistency. The focused branding/content run also passed all four tests. No hosted database was touched by these checks.

The separate configured production build stopped at the existing registration gate because the local Leader approval proof was stale. It did not bypass that gate or change registration settings. The push-triggered release workflow performs its own fresh readiness verification before the configured production build.

The source and pixel audit is complete. Full rendered acceptance remains **unverified**. The browser connector reported that its access host was unavailable. Native Chrome verification was then stopped by Computer Use because it could not determine the current browser URL confidently enough to enforce policy. No rendered-page pass, screenshot comparison, authenticated-session pass, Arabic/English visual matrix or mobile/tablet/desktop visual matrix is claimed.

No placement was blocked by a missing approved transparent asset. The unresolved item is rendered verification, including the mobile footer and actual authenticated pages. Deployment status and completed automated checks are reported with the release handoff.
