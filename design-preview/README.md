# iAnalyze Academy — Phase 00 static preview

Open `index.html` directly in Chrome, Edge or another modern browser. No installation or build is needed. Fonts, logos and the bilingual dictionary bundle are local. Use the top **Preview view** selector to inspect public pages, Student, Organizer, Leader/Admin, Activity and Wireframes. Use **AR / EN** in the main header to change language and direction without losing the current view. The proposed initial language is Arabic; the preference persists where browser storage allows.

For optional HTTP review from the repository root:

```powershell
python -m http.server 4173 --bind 127.0.0.1 --directory design-preview
```

Then open `http://127.0.0.1:4173/`. Stop the server with Ctrl+C when done. Serve only `design-preview`, not Downloads or any future private documents.

This is a local design artifact. All accounts, ranks, statistics and submissions are synthetic. No authentication, backend, form delivery, file selection/upload, grading engine or course management exists. Buttons for those actions are disabled. The application fields allow visual exploration but must not receive real personal information. Only the language preference is stored.

Translation sources are `locales/ar.json` and `locales/en.json`. After editing them, run `node tools/build-preview-locales.mjs` **from the repository root** to regenerate `locales.js`. This classic-script bundle permits direct `file://` opening, which cannot reliably fetch local JSON. No production React app has been initialized.

Original logos are preserved unchanged. Cairo and Inter are under SIL OFL 1.1; notices are in `assets/fonts/`. Icons and the illustrative chart are original code-native graphics. No stock photographs, paid assets, invented contact details or video URLs are used. The private Team Syllabus is absent from this preview and repository.

Planning documents and the full Phase 00 review are in `../docs/phase-00/`. Phase 01 requires the project owner's approval.

## Visual refinement review

The refined preview reworks all twelve high-fidelity views and adds native motion in `motion.js`. Entrance and scroll effects are brief and finite; decorative movement ends within five seconds. The sample progress ring/bar never changes the actual sample score or accessible value. Reduced motion removes animation, and keyboard focus cancels movement of the focused region.

Open `../docs/phase-00/refinement/index.html` for paired before/after screenshots of every view in English desktop and Arabic mobile layouts. The visual audit, motion decisions, changed-file list, and actual verification results are recorded in `../docs/phase-00/refinement/visual-refinement-review.md`. Original Phase 00 planning documents and screenshots are preserved as the initial review record.
