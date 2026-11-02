# First Cloudflare Pages deployment — predeployment plan

Historical predeployment findings follow. The owner subsequently approved this exact
candidate and its first deployment completed; see the
[deployment results](pages-first-deployment-results.md) for the live URL, deployment ID
and actual verification results. Backend activation remains unapproved.

Verified on 2026-11-02 (Asia/Amman). Target: the existing `ianalyze-academy` Direct
Upload project, reserved domain `https://ianalyze-academy.pages.dev/`.

## Finding

Authenticated Wrangler inventory confirms one matching Pages project, Git Provider `No`,
and **zero deployments**. An independent HTTPS GET returned **522**, with a valid TLS
connection and Cloudflare response headers. There is no application deployment behind
the reserved hostname yet. The missing deployment is the immediate blocker; no other
Cloudflare configuration defect was identified from the available project inventory.
Actual production asset/routing health can only be confirmed after an approved deployment.

No new Pages project, DNS change, Git integration, deployment or Supabase setting change
was performed by this readiness check. Do not try to fix this by pointing the Pages
hostname at a server or creating another project.

Cloudflare documents empty-project creation and the subsequent asset deployment as
separate steps: [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).

## Build and exact publication contents

From the repository root, using the existing Node 24/npm 11 toolchain:

```powershell
node frontend/scripts/build-pages-public.mjs
node frontend/scripts/check-pages-artifact.mjs
```

The first command runs TypeScript and the normal Vite production build with an empty,
isolated environment directory. It ignores real `.env` files and overrides all launch
variables with safe values. The existing ignored `.env.local` contains local browser-test
configuration and must never determine a production artifact. Do not substitute a plain
`npm run build` while that test configuration is present.

Upload **only the contents of `frontend/dist/`**:

- `index.html` at the publication root.
- `assets/`: compiled JavaScript/CSS, the existing supplied portraits, logos and fonts.
- `licenses/Cairo-OFL.txt` and `licenses/Inter-OFL.txt`.
- `_headers`, interpreted by Cloudflare as response policy configuration.

The tested artifact contains **18 files, 4,300,495 bytes**. The exact file names, sizes
and SHA-256 values are recorded in [pages-artifact-manifest.json](pages-artifact-manifest.json).
Any source or artifact change requires rebuilding and refreshing this inventory before
approval. `dist/` remains generated/ignored; the source changes need their feature-branch
commit and review before the final deployment authorization.

Never upload the repository root, source, `.env*`, credentials, `node_modules`, docs,
tests, artifacts, SQL migrations, Supabase functions or local database files.

## SPA routing and response security

Use Cloudflare Pages' **native SPA fallback**, with `dist/index.html` present and no
top-level `dist/404.html`. No catch-all `_redirects` rewrite is needed. Cloudflare serves
existing assets directly and supplies the root document for application routes such as
`/videos`, `/team` and `/auth/callback`.

The earlier local-only `/* /index.html 200` rule was removed before any deployment.
Cloudflare redirect/proxy rules take priority over matching assets; such a broad rule
could rewrite JavaScript, CSS and image requests to HTML.
[SPA behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering),
[redirect precedence](https://developers.cloudflare.com/pages/configuration/redirects/#per-file).

`frontend/public/_headers` is copied to `dist/_headers`. It sets CSP with a hash for the
existing inline preference script, self-hosted scripts, the approved Drive iframe,
restricted connection targets, no framing, no referrer, MIME sniffing protection and
disabled camera/microphone/geolocation. `/auth/*` receives `Cache-Control: no-store`.
The built inline script's hash was checked against the actual CSP.

## First-deployment environment

| Build variable                  | Required first-release value |
| ------------------------------- | ---------------------------- |
| `VITE_SUPABASE_URL`             | Empty                        |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Empty                        |
| `VITE_ENABLE_DEV_PREVIEWS`      | `false`                      |
| `VITE_ENABLE_REGISTRATION`      | `false`                      |
| `VITE_ENABLE_SUBMISSIONS`       | `false`                      |
| `VITE_ENABLE_LEADERBOARD`       | `false`                      |
| `VITE_PRIVACY_APPROVED`         | `false`                      |

No Cloudflare runtime variables or Supabase credentials are needed to serve this first
public-site artifact. It excludes the unapproved privacy draft and leaves the backend
unconfigured. Registration and upload activation remain separate approval gates.

Vite variables are baked into the build. Changing Dashboard variables later cannot change
an already uploaded Direct Upload bundle; a reviewed rebuild is required.
[Vite environment behavior](https://vite.dev/guide/env-and-mode).

## Actual readiness checks

- Production build and TypeScript: passed.
- ESLint and formatting: passed.
- All **25 unit/frontend tests**: passed, including the original tests and routing/CSP guards.
- Production boundary, Phase 02 preservation and Phase 03 preservation/secret-pattern checks: passed.
- Database type drift check: passed.
- Artifact scan: passed; no real keys/JWTs, local Supabase endpoint, source maps,
  development previews or unapproved privacy text found; every file is below Pages' 25 MiB limit.
- Real **local Cloudflare Pages emulator**: 14 direct SPA paths returned the correct root
  document, all 14 compiled assets matched their SHA-256 values, response security headers
  were present and callback routes were `no-store`.
- Production browser sweep against that local Pages emulator: **64 combinations passed**
  (eight public routes, Arabic/English, light/dark, 390/1440 pixels), with no application
  exceptions or configured-backend requests.
- Hosted deployment/smoke checks: **not executed**, awaiting explicit deployment approval.

Ignored local logs, browser results and the generated manifest are under `frontend/artifacts/`.
The local emulator is not a cloud deployment.

## Deployment sequence — execution requires owner approval

1. Freeze/review the feature-branch source and verify the exact approved artifact manifest.
   Confirm the authenticated account and existing project again. Do not create a project.
2. Obtain explicit approval for **first public-site deployment only**, identifying the
   reviewed source/artifact. This does not authorize backend activation or student launch.
3. Upload only `frontend/dist` to the existing project's production deployment label:

   ```powershell
   # NOT EXECUTED. Run only after explicit deployment approval.
   npx.cmd --yes wrangler@4.156.0 pages deploy frontend/dist --project-name ianalyze-academy --branch main
   ```

   `--branch main` selects Cloudflare's production alias; it does not push or modify the
   Git main branch. The project already exists, so the CLI must use its Pages deployment
   path. Do not use `wrangler deploy`, create a Worker, supply a new project name, connect
   Git or pass asset paths outside the verified directory.

4. Verify a successful deployment and canonical alias, HTTP 200 at the reserved HTTPS
   URL, direct-route reloads, actual JavaScript/CSS MIME types, CSP, RTL/LTR, themes,
   portraits/video and mobile layout. Confirm registration/uploads remain closed and no
   Supabase calls occur. If 522 persists after a successful deployment, investigate that
   deployment's alias/status and Cloudflare service health; do not make speculative DNS changes.
5. Record the deployment ID, source commit and artifact hashes. Preserve the artifact.
   Since no prior deployment exists, there is no older production version to roll back
   to. A failed first release requires an approved corrected deployment or an explicitly
   approved removal; do not promise an unavailable rollback.

## Separate academy-launch blockers

This first publication makes the existing public website accessible. It does not mean the
full student academy is launched. Hosted migration inventory/backup/dry-run/approval,
database activation, verified Brevo delivery, privacy/content approvals, controlled Auth
tests and trusted submission activation remain separate work.

The owner inspected Supabase URL settings and reported `http://localhost:3000` with no
redirect URLs. Those values must not be used for production Auth. Once the callback is
served and the backend/Auth test scope is approved, propose these exact hosted changes:

- Site URL: `https://ianalyze-academy.pages.dev`
- Redirect URL: `https://ianalyze-academy.pages.dev/auth/callback`

No hosted URL settings were changed. Brevo SMTP was configured by the owner; transactional
activation and real delivery are not yet independently verified. No production test account,
student registration, upload activation or hosted migration is authorized by this plan.
