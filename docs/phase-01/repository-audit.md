# Phase 01 repository audit

Audited 31 October 2026 before application implementation. The user's Phase 01 brief authorizes the React foundation and dark theme, superseding the earlier Phase 00-only restrictions. It does not authorize Phase 02 content, authentication, backend integration, deployment, commits or pushes.

## Existing state

Git showed only the existing untracked `design-preview/`, `docs/`, and `tools/` trees. The tracked root README contained the project name and short description. There was no package manifest or React application. No applicable AGENTS.md was found in the workspace or checked ancestors.

Read the Phase 00 requirements, sitemap, design system, component inventory, user flows, data/security architecture, missing-content register, wireframes, review and latest refinement addendum. Inspected the current static preview, its renderer/styles/motion, localization structure and public Student Syllabus. The latest renderer, rather than historical screenshots, is the final visual reference: the header subtitle has already been deleted in both languages and its unused Academy key removed.

The separate `frontend/` directory keeps Vite's public/build inputs independent of the planning archive. `preserved-phase00.json` records hashes of all 122 existing Phase 00/preview files before setup; verify them at handoff. The original root README will retain its original description with an appended frontend entry point.

## Assets and reusable decisions

- Original `design-preview/assets/ianalyze-logo.png` and `iteam-logo.png`: 2172 × 724 transparent PNGs, adequate resolution. Use the original bytes and a light backing in dark mode; no redraw, recoloring or destructive crop.
- Local `design-preview/assets/fonts/Cairo.ttf` and `Inter.ttf`, with their SIL OFL notices. Reuse these files; no font download or external font CDN.
- Approved Modern Academy: official colors, generous whitespace, refined cards/buttons, bilingual typography, logical spacing, LTR code and numeric isolation, subtle bounded motion, reduced-motion support.
- Parent iTeam remains in the footer. No text beneath the header logo.
- `docs/phase-00/student-syllabus-source.md` is public context only; full public-page content remains Phase 02.
- The private Team Syllabus remains outside the repository and is not an application input. It is not needed for this phase and will not be read, copied, bundled or demonstrated.

## Scope decisions

Eight public routes receive shared layouts and clearly identified content foundations, with a small representative Home hero. Student, Organizer and Leader shells are demonstrated only under a labeled local development namespace that is compiled out of production. A development-only component gallery exercises the shared primitives. No accounts, role grants, private documents, real student records, registration, uploads, grading or ranking calculations.

## Official setup references

Verified current instructions: [Vite](https://vite.dev/guide/), [Tailwind Vite plugin](https://tailwindcss.com/docs/installation/using-vite), [shadcn/ui Vite](https://ui.shadcn.com/docs/installation/vite), [React Router declarative mode](https://reactrouter.com/start/declarative/installation). Use `@tailwindcss/vite` and a CSS import, not a copied Tailwind v3 configuration. Use npm; on this Windows host `npm.cmd` avoids the PowerShell script execution-policy restriction without changing that policy.

The current Vite React/TypeScript scaffold selected TypeScript 7. The current `typescript-eslint` adapter requires TypeScript below 6.1; select the latest compatible 6.0 patch rather than force an invalid peer dependency tree. Exact installed versions are recorded by the package lock and final review.
