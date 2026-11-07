# Videos-page redesign review

This local change builds on unmerged commit `233cdd8` and remains uncommitted. It changes only the two Videos-page cards, their approved metadata and copy, local verification tools, and this review material.

## Result

Both cards now begin as responsive 16:9 covers with a centered Play control, visible title, dark readability gradient, keyboard focus, touch/pressed feedback, RTL/LTR support, and reduced-motion handling. The player window has a stable `width: 100%` / `max-width: 100%` footprint and fixed 16:9 aspect ratio; the activated iframe is absolutely fitted into that same box, so loading it cannot resize the card. No provider iframe is requested before Play.

The Google Drive card uses an iAnalyze-branded CSS cover. Activating it creates the existing Drive preview iframe. The same node remains mounted when the existing Expand control moves between inline, modal fallback, and native fullscreen. Close, Escape, focus restoration, and the direct Google Drive fallback remain present.

The Kaggle card uses the real thumbnail returned for the approved Arabic tutorial. Activating it creates one privacy-enhanced YouTube iframe with fullscreen and picture-in-picture permissions; it does not request autoplay. The direct YouTube and source fallbacks remain present.

## Screenshots

- [Narrow mobile rendering, both cards](videos-mobile-390.png)
- [Desktop rendering, both cards](videos-desktop-1440.png)

The desktop capture is 1440 CSS pixels. Chrome on Windows enforces a minimum headless layout width, so the mobile artifact is a narrow mobile-layout screenshot captured at 488 CSS pixels with 1.25 device scale; it is not evidence for a physical 390px device. The application's checked-in browser matrix targets 320, 360, 375, 390, 430, 768, 820, 1024, 1280, 1440, and 1920, but the current installed Chrome and Edge processes terminated when this session sent any CDP command. Static Chromium rendering and DOM inspection succeeded; interactive CDP results from this implementation are therefore not claimed.

## Verification

- Full `npm run validate`: TypeScript, ESLint, 57 unit/regression tests, formatting, production build, CSP/artifact checks, historical preservation, 32 embedded database-security checks, and database type checks passed.
- Public YouTube verification and selection evidence: [Kaggle tutorial verification](kaggle-verification.md).
- Chromium production fixture DOM: both covers render and zero video iframes exist before activation.
- Visual inspection: both stored screenshots show complete cards, centered Play controls, titles, fallbacks, and no visible horizontal clipping at the captured widths.
- The existing CSP is unchanged. The YouTube thumbnail is served from the application origin.

## Provider and device limitations

Google owns the controls inside its Drive iframe; this change avoids presenting those controls until the user explicitly starts the player and retains the external fallback, but it does not customize or guarantee Google's native controls. YouTube availability and embedding can change after verification. No physical Android or iOS device was used. Interactive browser automation and axe reruns for this exact working tree remain incomplete because the installed Chromium processes crashed at CDP command dispatch; the repository pipeline and non-interactive Chromium rendering passed.
