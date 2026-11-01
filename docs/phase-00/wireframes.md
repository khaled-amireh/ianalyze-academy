# Desktop and mobile wireframes

Open `design-preview/index.html#wireframes` for a local grayscale gallery of **all ten** required page types, each shown as a desktop and mobile composition. The gallery is generated from the same bilingual dictionaries as the high-fidelity preview and has AR/EN switching. It contains no private syllabus text. The schematic labels describe region priority, not final content density.

The standard desktop frame is a 12-column content grid inside a 1200px maximum. Mobile reads in DOM order with 16px side gutters; secondary panels follow the primary task. Public pages share identity/nav/footer. Dashboards use role-specific reading-edge navigation. The gallery fits narrow screens; its miniatures intentionally represent layouts rather than literal scaled screenshots. Full high-fidelity pages provide actual text-size/reflow review.

| Page | Desktop composition | Mobile composition / priority |
| --- | --- | --- |
| 1. Home | Header; two-column hero statement + data journey; 3 course facts; featured EDA split panel; learning benefits; library/community links; Join; parent footer | Identity/menu/language; statement and CTA; illustration; facts; syllabus/program; benefits; community; Join; footer |
| 2. About | Page heading; mission + vision side by side; iTeam relationship band; community values; pending achievements note | Intro; mission; vision; parent connection; values; honest pending history |
| 3. EDA syllabus | Heading and facts; main outcomes + accordion weeks; narrow prerequisites/project aside; joining CTA | Facts; objectives; weeks; prerequisites; project; CTA; no internal lesson timings or teaching script |
| 4. Video library | Prior-program label; category controls; three-column thumbnail/title/description cards when supplied; present empty state | Context; category chips; full-width empty state; future one-column videos with click-to-load embed |
| 5. Our Team | Leader wide card; Organizer grid; neutral photo placeholders; short bio/link slots | Leader first; one card per Organizer; no invented real identity |
| 6. Registration | Intro/privacy context aside; two-column labeled form; full-width consent; unavailable submit explanation | One field per row; short helper text; acknowledgement and no-live-submission notice; no horizontal radio groups |
| 7. Student dashboard | Sidebar; demo account header; progress/points/next activity stats; activity list main; announcement/feedback aside | Wrapping nav; demo label; progress; next activity; activity list; announcements; feedback/achievements |
| 8. Activity and submission | Back link; instructions + code; rubric before upload; upload appearance + status/history panel | Instructions; LTR code; rubric labeled rows; deadline; unavailable upload; history; localized state examples |
| 9. Leaderboard | Privacy explanation; restrained ordered table; personal-position card; ties/approved-points note | Same information as vertically labeled rows; no public detailed grades; personal rank clearly demo/private |
| 10. Organizer / Admin | Shared team shell with separate Organizer and Leader views; assigned review queue/rubric/feedback for Organizer; applications/activities/results/announcements/roles for Leader | Role nav wraps; scope notice; prioritized queue; one panel per task; all actions unavailable in preview |

Contact/FAQ has an additional high-fidelity view: known answers in native disclosures; pending contact region. Ten required wireframe types are available alongside twelve high-fidelity views (Organizer and Leader are separate).

## Interaction annotations

The responsive menu is a disclosure, course modules and FAQs use native disclosures, preview routing uses hash links, and language switches preserve the page. The fixed sample activity state selector previews empty/loading/success/error states. Proposed registration form controls permit visual input only; there is no submit handler, persistence, transmission, or upload input. Staff buttons are disabled with explanatory context. Wireframe regions carrying “Team Syllabus” only mark a future authorized boundary.

Keyboard: skip link → preview tools → identity/navigation/language → main heading → page controls → footer. Page navigation focuses the new heading; language changes preserve the current focused stable control when possible. Mobile menu closes on selection and Escape. Native controls remain usable without mouse hover. Review actual screenshots and verification limits in `phase-00-review.md`.
