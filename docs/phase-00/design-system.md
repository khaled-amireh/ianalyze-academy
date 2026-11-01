# Brand and design system

**Modern Academy** is the approved direction. The visual system gives learning content room to breathe: a quiet off-white canvas, deep navy headings, restrained teal surfaces, warm orange accents, compact information labels, and generous reading space. A simple data illustration connects the identity to exploration without robots or futuristic decoration.

## Brand assets

The original `ianalyze-logo.png` and `iteam-logo.png` are used unchanged in `design-preview/assets/`. iAnalyze is primary in the header; iTeam is the parent identity in the footer and “An iTeam Initiative” supporting text. Both retain their original proportions, colors, and embedded effects. Add no filters, shadows, cropping, recoloring or reconstruction. `object-fit: contain`; reserve at least 16px whitespace around the visible mark, and use a white backing rather than modifying the image. Never squeeze the parent logo into an icon. The supplied PNGs are usable originals as provided; optional vector masters remain desirable, not missing required assets.

## Official palette and semantic tokens

| Token | Value | Use / foreground |
| --- | --- | --- |
| brand.navy / action.primary | `#08546f` | Primary buttons with white text |
| brand.teal | `#429eab` | Brand detail / decorative charts; dark text `#142e3a` where text is needed |
| brand.orange | `#df8a48` | Small accents / warm highlights with dark text; never white body text |
| brand.red / error.text | `#9e2619` | Error text or error solid with white text |
| canvas | `#f3f7fa` | Official suggested light background |
| surface | `#ffffff` | Cards, menus, inputs |
| surface.subtle | `#eaf3f5` | Teal-tinted sections |
| surface.warm | `#fbf2e9` | Program note / restrained highlight |
| text | `#142e3a` | Main text |
| text.muted | `#526875` | Supporting copy on light surfaces |
| border | `#d7e2e7` | Nonessential separators |
| input.border | `#738894` | Essential input boundary on white |
| action.hover | `#063f53` | Navy primary hover, white text |
| action.secondary | white / `#08546f` | Navy border and text |
| focus | `#08546f` | 3px ring with white separation; on dark surfaces use white ring |
| success.text / surface | `#216344` / `#e9f5ed` | Check icon + localized text |
| warning.text / surface | `#784319` / `#fbf2e9` | Clock icon + localized text |
| error.surface | `#fbeeea` | Error icon + explanatory text |
| disabled.text / surface | `#526875` / `#e8edf0` | Unavailable actions plus visible reason |

All official hues are retained as brand tokens; derived tones provide accessible semantics. Teal and orange are not default white-text buttons. `tools/verify-phase00.mjs` computes contrast for actual text/surface pairings; executed measurements are in `qa-results.json`. Borders used only as decoration need not meet control-boundary contrast. Text on buttons/cards, focus rings and input boundaries must meet the applicable threshold. Status has text/icons as well as color.

## Typography

English: **Inter**, weights 400–700. Arabic: **Cairo**, 400–700, with a more generous line-height. Both are freely licensed under SIL OFL 1.1; retain the bundled license files. Source: [Inter OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt), [Cairo OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/cairo/OFL.txt). Bundle font files locally; no CDN dependency for preview. Fallbacks: system sans-serif for English, Tahoma/Arial for Arabic. Avoid forced letter spacing in Arabic.

| Role | Desktop | Small viewport | Weight / line height |
| --- | --- | --- | --- |
| Hero | fluid 40–72px | 36–42px | 650–700 / 1.12 EN, 1.45 AR |
| Page heading | 36–48px | 30–36px | 650 / 1.2 EN, 1.5 AR |
| Section heading | 26–32px | 24px | 650 / 1.35 |
| Card heading | 19–22px | 18–20px | 650 / 1.5 |
| Body | 16–18px | 16px | 400 / 1.7 EN, 1.95 AR |
| Label / metadata | 13–14px | 13–14px | 500–600 / 1.6 |
| Code | 13–14px monospace | 13px | 400 / 1.7; LTR always |

Keep paragraphs at approximately 60–72 Latin characters per line, with Arabic visually reviewed rather than constrained by the same character count. Localize page titles and numbers where useful; retain technical course names as isolated English references alongside Arabic labels. No ambiguous numeric deadline dates: future UI uses localized dates + Asia/Amman time.

## Geometry and layout

Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px. Base page container 1200px, 24–40px gutters on desktop, 16px on narrow screens. Section rhythm 64–88px desktop, 40–56px mobile. Cards use 24–32px padding desktop and 20px mobile. Card radius 16–20px, input/button 10px, pill 999px. One-pixel subtle borders. Shadow: `0 12px 32px rgb(8 84 111 / .05)`; use sparingly for elevated hero illustration/dialogs. No glass effects or heavy gradients.

Breakpoints are content-driven: 640px (small → two columns where space allows), 900px (desktop navigation and dashboard sidebar), 1200px (full content width). Review specifically at 320, 390, 768, 1024 and 1440px. Stack hero and side panels below 900px. Cards use `minmax(0,1fr)` and words wrap; no fixed minimum wider than 288px. Dashboard tables reflow into labeled row groups on small screens, preserving header associations. Do not hide essential columns to make a table fit.

## Component behavior

| Component | Specification and states |
| --- | --- |
| Buttons | Primary navy, secondary outlined, quiet text. Minimum 44px height; icon + text where meaningful; no hover-only actions. Disabled controls have a nearby reason. Loading label does not erase the accessible name. |
| Cards | One heading and a clear information priority; full-card links only when no nested interactive elements. Course cards have week, topic, description. Activity cards have state, deadline and rubric link. |
| Inputs/forms | Visible labels, required state in words or explained indicator, helper text before entry, errors associated with `aria-describedby`, error summary after failed future submit. Radio groups/checkboxes have legends. No placeholder-only labels. |
| Tables | Caption, scoped headers, numeric alignment, generous row height; readable labeled mobile rows. Reviews need attempt/version context. Empty states span the whole region. |
| Navigation | Current item with `aria-current`, visible language control, skip link, disclosure mobile menu. Focus order follows reading order without CSS reordering. No hover-only submenu. |
| Status/badge | Readable localized label, optional simple symbol, semantic surface; distinguish workflow state from Late flag. Achievements must explain criteria, not imply a certificate. |
| Progress | Numeric explanation plus accessible progressbar. No arbitrary progress promise; preview clearly marks synthetic values. |
| Review panel | Student alias, assigned attempt, private download action, rubric, feedback, save-draft and submit-review actions. Leader approval separate. |
| Dialog | Future use: accessible name, trapped focus, Escape, explicit close, return focus to invoking control; never use for ordinary navigation. No unnecessary demo modal. |
| Notices | In-context persistent message; status announcement for meaningful async results, alert for errors. No toast-only receipts. |

## Direction, language and iconography

Use `margin-inline`, `padding-inline`, `border-inline-start`, `text-align:start`, and logical layout. Arabic sidebar/nav starts on the right; English on the left. Directional arrows mirror, while play buttons, logos, charts, clock symbols and code do not. Handwritten simple SVG icons use `currentColor`, 1.7px strokes, consistent 20–24px boxes, no commercial icon kit. Decorative icons are hidden from assistive technology; icon-only buttons need localized names. Use `bdi dir=ltr` for terms and `pre dir=ltr` for Python. Phone/email strings, future URLs and file extensions retain LTR ordering.

## Motion and themes

Transitions only for color/focus or small menu affordances, 120–180ms; no parallax, autoplay, bouncing or continuous animated charts. `prefers-reduced-motion: reduce` removes transitions and smooth scrolling. Light is the only Phase 00 implemented theme. Future dark theme is optional and unapproved: use navy-neutral surfaces, lighter text, recheck every semantic pair, and keep original logos on white backing with adequate whitespace. Do not invert logos. Do not implement an unreviewed theme toggle.

## Accessibility review contract

Target [WCAG 2.2 AA](https://www.w3.org/WAI/WCAG22/quickref/). Verify keyboard reachability, no trap, focus visibility, menu disclosure state, current-page context, translation parity, heading order, contrast, 320px reflow, 200% zoom/reflow, text spacing, code direction and reduced motion. Screen-reader and manual assistive-technology checks remain separate from DOM automation. Actual executed checks and limits are recorded in `phase-00-review.md`; a good screenshot is not proof of conformance.
