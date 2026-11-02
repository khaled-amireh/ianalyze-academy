# Theme and logo update

Uses the four owner-supplied PNGs with their original pixels preserved in `frontend/src/assets/brand/*-original.png`. The rendered PNG derivatives are 640px wide to keep header/footer downloads small.

| Theme | iAnalyze source                  | iTeam source                  |
| ----- | -------------------------------- | ----------------------------- |
| Light | `logo dark(ianalyze).png`        | `logo dark(iteam).png`        |
| Dark  | `ianalyze_light_for_dark_bg.png` | `iteam_light_for_dark_bg.png` |

Both variants occupy the same reserved image space and load together when visible, so switching does not resize the header or wait for a new logo download. Each pair has one accessible image name. The previous white logo backgrounds are removed.

The light palette uses `#E3F2FD` for tinted surfaces, `#90CAF9` for accents/charts, `#2196F3` for the brand accent and `#0D47A1` for readable primary actions. The dark palette uses `#200E3A` as its foundation, `#38419D` for accent surfaces, `#3887BE` for the supporting brand/chart color and `#52D3D8` for primary actions and emphasis. Related surface/text shades preserve hierarchy and contrast.

Manual switches animate colors and sun/moon feedback briefly. Reduced motion makes changes immediate. The theme button is directly available in the mobile header, while language options remain in the menu. A saved manual choice takes precedence over the OS; otherwise the interface follows live system appearance changes. Preference changes sync between tabs through the existing storage key. No page remount or navigation occurs during a switch.

Verification: see the refreshed [route/layout/contrast evidence](browser-results.json), [focused theme checks](theme-brand-results.json) and [screenshots](screenshots/home-en-dark-1440.png). Run `node scripts/theme-brand-browser-qa.mjs` after the existing browser harness, using the same task-owned Chrome profile and local production preview.

The palette update passed 160 route/language/theme/width cases, 38 existing browser interaction assertions, and all sampled contrast checks. The final mobile quick-switch refinement additionally passed 17 focused theme assertions, including header fit at 320, 390 and 640px in both modes. Type checks, production build, lint, formatting, 17 frontend tests and preservation checks passed. Screenshots were refreshed after the mobile-header refinement.

Backend and authentication/authorization files are unchanged. This theme update adds no packages or deployment changes.
