# Phase 00 — Visual refinement review

Status: **complete for owner review; Phase 01 remains unstarted.** This addendum records a comprehensive redesign of the existing twelve static views. The original planning documents, syllabus source, original screenshots and first QA report are preserved unchanged.

Open the [refined static preview](../../../design-preview/index.html) or the [before-and-after comparison gallery](index.html). Both work directly from the filesystem. No build, installation, account or internet connection is required. Use AR/EN and the preview-view selector in the website. The comparison gallery offers every page in English at 1440px and Arabic at 390px, with synchronized scrolling and links to full-resolution PNGs.

## Audit findings and response

The original system was consistent but depended heavily on the same heading-and-card arrangement. The primary identity was small, public pages had similar visual weight, the application lacked section structure, and staff review did not show a convincing queue-to-review relationship. The redesign changes page composition as well as typography, spacing, component treatments and motion.

All twelve views were audited through original captures, source/content review, desktop/mobile captures of the redesign, and browser checks. The wireframe gallery also retains its ten layout pairs and benefits from the refined shared shell; it remains intentionally grayscale.

## Improvements to every page

Each row links to matched English desktop captures. Arabic mobile pairs for **all twelve pages** are available in the comparison gallery and corresponding `before/` and `after/` folders.

| Page | Audit finding → completed redesign | Before | After |
| --- | --- | --- | --- |
| Home | A quiet, generic split hero → an editorial two-tone headline, stronger official identity, framed data board, notebook annotation, learning-facts strip, navy EDA course cover, staged learning journey, numbered benefit cards, asymmetric community/library section and clearer Join feature. | [PNG](before/home-en-1440.png) | [PNG](after/home-en-1440.png) |
| About | Separate mission/vision cards felt interchangeable → a unified manifesto composition with numbered statements, a dedicated iTeam relationship band and connected values panel. Draft copy labels and pending history are retained. | [PNG](before/about-en-1440.png) | [PNG](after/about-en-1440.png) |
| EDA Syllabus | A dense accordion list with a generic aside → numbered learning outcomes, individually framed module cards along a vertical path, stronger week markers, program essentials, tool chips and a prominent final-project panel. Public source content is retained. | [PNG](before/syllabus-en-1440.png) | [PNG](after/syllabus-en-1440.png) |
| Video Library | A large empty box → an archive toolbar, refined topic controls and an original illustration of an empty video library. The previous-program distinction and honest missing-video state remain explicit. No titles, durations or URLs were invented. | [PNG](before/videos-en-1440.png) | [PNG](after/videos-en-1440.png) |
| Our Team | Small interchangeable profiles → an editorial introduction, a featured navy Leader placeholder, larger portrait areas and clearer Organizer role cards. No real identities or photographs were fabricated. | [PNG](before/team-en-1440.png) | [PNG](after/team-en-1440.png) |
| Registration | One continuous form → three numbered sections, more generous labeled fields, selectable radio cards, a clear privacy section, program summary and proposed application journey. Real input must not be entered; submission stays disabled. | [PNG](before/join-en-1440.png) | [PNG](after/join-en-1440.png) |
| Leaderboard | A flat table → clear rank markers and alias grouping, larger approved-point values, a separate navy personal sample-ranking card and an opt-in privacy panel. The underlying table semantics and sample totals remain intact. | [PNG](before/leaderboard-en-1440.png) | [PNG](after/leaderboard-en-1440.png) |
| Contact & FAQ | A simple FAQ list → a dedicated contact rail, numbered disclosures, a visible first answer and a calmer question/answer rhythm. Contact information is still explicitly pending. | [PNG](before/contact-en-1440.png) | [PNG](after/contact-en-1440.png) |
| Student Dashboard | Equal-weight summary widgets → a navy sample-progress feature with an animated ring/bar, distinct points and next-session cards, clearer activity cards, a private-feedback treatment, announcement panel and achievement seal. Sample data labeling is retained. | [PNG](before/student-en-1440.png) | [PNG](after/student-en-1440.png) |
| Activity & Submission | A collection of panels → a preparation sequence, framed LTR Python example, clearer rubric and attempt history, deadline-led submission panel and improved state illustrations. File selection/upload remains unavailable. | [PNG](before/activity-en-1440.png) | [PNG](after/activity-en-1440.png) |
| Organizer | A long isolated grading form → a synthetic assigned review queue alongside the selected review, explicit attempt/file context, clearer draft rubric controls, feedback area and approval boundary. On mobile these follow a clear reading sequence. | [PNG](before/organizer-en-1440.png) | [PNG](after/organizer-en-1440.png) |
| Leader / Admin | Repetitive operational cards → a fixed-program identity strip, more legible application-review area, five-activity-plus-project sequence and distinct operational cards for results, announcements, roles, students and approved content. No course-management interface was added. | [PNG](before/admin-en-1440.png) | [PNG](after/admin-en-1440.png) |

## Shared visual decisions

- Retain the light Modern Academy canvas and official navy, teal, orange and red. Navy anchors the course feature and selected learning/private contexts; white and pale teal keep the rest comfortable for reading. Warm accents distinguish guidance, achievements and illustrative progress.
- Increase the iAnalyze logo from 198px to **258px** on full desktop, and from the previous 128px mobile treatment to **142–182px**, as space permits. Whitespace, white backing, a clearer Academy caption and separate parent identity improve recognition. Original logo bytes, proportions, colors and effects are unchanged.
- Keep locally bundled Inter/Cairo. Increase heading confidence and strengthen the distinction between titles, section labels, task metadata and supporting text. Arabic retains its own line height and no artificial letter spacing. Technical terms, ratios, times and Python remain directionally isolated.
- Use a 1240px maximum layout with deliberate section rhythm, asymmetric public compositions, 16–22px surface corners, restrained borders and soft ambient shadows. Dashboards retain tighter task-focused spacing.
- Redesign buttons, link arrows, navigation indicators, segmented language controls, cards, module markers, forms/radios, status rows, progress widgets and ranking elements. Hover/pressed/focus treatment follows one coherent motion vocabulary.
- Preserve the Student/Organizer/Leader access distinctions as design communication. New queue entries are synthetic aliases; the private syllabus is still represented only by a restricted-document boundary.

### Logo quality

Both originals are **2172 × 724 RGBA PNGs with transparency**. They are sufficient for the current 258px maximum header display and were hash-checked against the provided sources. **No higher-resolution or transparent replacement is needed for this refinement.** Optional vector masters remain useful for future print/large-format work, but are not a blocker. No artwork was cropped, recolored, filtered or recreated.

## Motion inventory

Native CSS transitions and the Web Animations API are used; no animation library was added. Motion reveals hierarchy and provides feedback, without changing the sample data or requiring animation to access content.

| Interaction | Behavior |
| --- | --- |
| Hero / page introduction | 540–680ms entrance, 65ms stagger, maximum 16px vertical travel; no movement of a region while it holds keyboard focus |
| Hero chart | Brief line drawing; finite decorative data-field drift ends within 4.6 seconds |
| Scroll reveal | One-time, 560ms reveal when a section enters the viewport; no persistent hidden-content class |
| Buttons / cards | 2px button lift, 3px card lift, 220–240ms easing; pressed buttons settle back into place |
| Navigation / language | Animated current-page underline and pressed-language surface; directional arrows respect RTL |
| Sample progress | 900ms ring/bar animation to the fixed sample value **2 of 6**; accessible value remains 2 throughout |
| Accordions / menu | 240ms / 220ms height transitions; interruption and rapid reversal are handled |
| Reduced motion | No entrance, reveal, decorative, progress or disclosure animation; final layouts and values appear immediately |

Preference changes cancel running effects. Focus cancels movement of the focused ancestor. Closed mobile navigation is inert and noninteractive, Escape returns focus to its trigger, and desktop resizing restores navigation availability. Decorative animation does not loop. If animation or observer APIs are unavailable, content remains visible.

## Executed checks and evidence

The dependency-free scripts use installed Chrome 156 and Node 24. Evidence is in [qa-results.json](qa-results.json) and [motion-qa.json](motion-qa.json). All claims below refer to checks actually executed during this refinement.

- **260 rendered combinations:** 13 routes (12 views plus Wireframes) × Arabic/English × 320, 390, 768, 1024 and 1440px × normal/reduced motion. The requested route, locale and width are checked against the rendered result. No horizontal overflow, broken final images, undefined/garbled placeholder text, unnamed buttons or unlabeled inputs were detected; each view has one h1.
- Translation structure parity, correct document direction/language, language persistence through navigation/reload, route preservation during language changes, LTR numeric ratios and LTR Python were checked.
- Keyboard Enter/Escape menu behavior, disclosure operation, visible 3px focus, 320px open-menu reflow, disabled submission, prevented form transmission, absent upload controls and all four activity states were exercised.
- **18 semantic contrast pairs** pass the specified text/control thresholds. This includes the newly introduced light text on navy and illustrative progress against its track; the progress track was darkened following measurement.
- **22 separate motion/interaction checks** pass: stagger, bounded decorative duration, final visible state, actual pointer hover/pressed button states, navigation underline, card lift, scroll reveal, progress animation and endpoint, accordion/menu motion and reversal, inert closed navigation, desktop resize, changing motion preference, immediate reduced-motion endpoints and focus safety.
- Direct `file://` product preview loading, fonts, images, navigation and language switching were exercised. The comparison gallery was also opened directly, with all 24 page/presentation choices loading both images successfully, and no overflow at 320px.
- Zero recorded JavaScript exceptions or external service requests. Intentional canceled image requests during rapid view changes are recorded separately from resource failures; final image completeness is checked.
- A 720px CSS-width reflow proxy and increased text spacing on the 320px Arabic application were checked. These are not claims of an actual browser UI zoom test.
- Original logos and public source assets remain byte-identical. All original planning documents and prior QA/screenshot artifacts are unchanged; baseline hashes are retained in `baseline-manifest.json`.

Still screenshots use reduced motion for a stable final composition. The motion suite runs separately with normal motion enabled and tests real animation endpoints. The screenshot set contains **29 matched before/after pairs**: all twelve views in English desktop and Arabic mobile, plus Arabic desktop Home, English mobile Home, 768px Arabic Syllabus, 320px Arabic Activity, and the Wireframe gallery. Additional verification captures are retained in `screenshots/`.

### Limits and remaining concerns

Screen-reader testing, real mobile hardware, Safari/Firefox, actual browser UI zoom and human bilingual usability sessions were not executed. The automated names/semantics/contrast checks do not constitute a WCAG conformance certificate. Some mobile staff pages are long because all planned review controls remain visible; real-content usability review should validate their density.

Approved team photos/bios, video metadata/URLs, contact/support information and final program policies are still pending, as already documented. Default language, draft syllabus version reconciliation, privacy and grading decisions remain owner decisions. No private syllabus content was modified or copied. The refinement creates no backend, account, upload, registration delivery, grading calculation, course management or deployment.

## Changed files

Modified existing preview files:

```text
design-preview/index.html
design-preview/styles.css
design-preview/script.js
design-preview/locales/ar.json
design-preview/locales/en.json
design-preview/locales.js
design-preview/README.md
```

Added:

```text
design-preview/motion.js
tools/capture-refinement.mjs
tools/verify-refinement.mjs
tools/verify-refinement-motion.mjs
docs/phase-00/refinement/index.html
docs/phase-00/refinement/visual-refinement-review.md
docs/phase-00/refinement/baseline-manifest.json
docs/phase-00/refinement/baseline/               preserved public preview sources
docs/phase-00/refinement/before/                 original screenshots
docs/phase-00/refinement/after/                  refined screenshots
docs/phase-00/refinement/screenshots/            verification captures
docs/phase-00/refinement/qa-results.json
docs/phase-00/refinement/motion-qa.json
docs/phase-00/refinement/preservation-check.json
```

The original `docs/phase-00/` requirements, architecture, flows, component inventory, wireframe specification, asset register and first review remain intact. This addendum records the updated visual and motion decisions without rewriting those completed documents. No package or paid dependency was added.

**Stop point: visual refinement complete for approval. Phase 01 has not begun.**
