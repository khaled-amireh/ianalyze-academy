# First public frontend deployment

Completed on 2026-11-02 (Asia/Amman), following explicit owner approval for the
reviewed public frontend artifact only.

- Live URL: <https://ianalyze-academy.pages.dev/>
- Deployment URL: <https://12bce49f.ianalyze-academy.pages.dev/>
- Deployment ID: `12bce49f-9d9f-4168-a22e-b57f5d8ab5a1`
- Existing project: `ianalyze-academy`, Direct Upload, Git Provider `No`.
- Cloudflare environment: Production; production branch label: `main`.
- Approved manifest SHA-256:
  `0f85151d0534d518798b0241c1979ec7a3a43061edc499bc44cb27205107c0f2`.

## Artifact and publication

Rebuilt with `node frontend/scripts/build-pages-public.mjs`, then ran the artifact
safety scan. Compared the generated manifest byte-for-byte with the previously
reviewed [18-file manifest](pages-artifact-manifest.json), including its known hash.
All paths, sizes and SHA-256 values matched: **18 files, 4,300,495 bytes**.
No changed candidate was deployed.

Pinned Wrangler `4.156.0` uploaded only the absolute `frontend/dist/` directory to
the existing project. It uploaded 17 static files and applied `_headers` separately
as response configuration. There are no Pages Functions or Worker files in this
artifact. No source files, environment files, credentials, source maps, development
previews, migrations, documents or test fixtures were uploaded.

The deployment used the approved working-tree candidate on
`codex/phase-04-08-functional-delivery`. Wrangler's inherited Source metadata is the
base Git commit `5bd9383`; it is **not** a commit containing all current working-tree
changes. The deployment was marked dirty and its message records the approved
manifest hash. The manifest and verified remote bytes identify the deployed build.
No Git branch, commit, push, merge or GitHub integration was performed by this
deployment operation. Cloudflare's `main` label selects its production alias and
does not modify the Git main branch.

## Actual verification results

- Rebuilt production bundle and TypeScript: passed.
- Approved artifact comparison and credential/source/preview scan: passed before
  deployment; artifact scan passed again afterward.
- Cloudflare reported successful deployment. Read-only inventory confirmed one
  Production deployment with the ID above and the same existing Direct Upload
  project with no Git provider.
- Canonical and deployment HTTPS URLs: **200**. The earlier **522 is resolved**.
- HTTP redirects to the canonical HTTPS URL.
- All **17 served files on both URLs** matched the approved file sizes and SHA-256
  hashes: **34 remote file comparisons**, including root HTML, all 14 compiled
  assets and both font licenses. JavaScript/CSS MIME types were correct.
- `_headers` is interpreted as configuration and is not exposed as a raw file.
  The actual CSP, no-referrer policy, MIME-sniffing protection, frame denial and
  camera/microphone/geolocation restrictions matched the reviewed configuration.
- **16 direct paths on each URL** returned the exact approved SPA root document:
  the eight public routes plus login, recovery, callback, reset, Student, Team,
  privacy and development-preview paths. `/auth/*` responses were `no-store`.
  Browser checks separately confirmed that private/unapproved paths do not expose
  their functionality; an HTTP SPA response alone does not establish authorization.
- Isolated Chrome production browser suite: **64 combinations passed**, covering
  all eight public routes, Arabic/English, RTL/LTR, light/dark, and 390/1440 widths.
  No horizontal overflow, application exceptions, unexpected first-party HTTP
  errors or Supabase requests were observed.
- Real Arabic/English controls, desktop links and mobile menu navigation passed.
  Both supplied Leader portraits loaded with their expected dimensions; the video
  iframe retained the approved Drive URL. Playback and third-party availability
  were not independently certified by these checks.
- Disabled registration fieldset, unavailable login/recovery forms, guarded
  Student/Team/reset routes, no upload control, placeholder leaderboard, excluded
  privacy draft and unavailable development previews were verified in the browser.
- Representative Arabic mobile and English desktop screenshots were inspected.

Reproducible read-only live checks:

```powershell
node frontend/scripts/test-pages-live.mjs
# Requires the dedicated isolated Chrome test profile on loopback port 9237:
node frontend/scripts/test-pages-live-browser.mjs
```

Ignored evidence files are `frontend/artifacts/pages-live-http.json`,
`pages-live-browser.json`, `pages-live-mobile-ar.png` and `pages-live-desktop-en.png`.
The original [predeployment plan](pages-first-deployment.md) records the approval
scope and separate backend activation steps.

## Launch state and remaining owner actions

The public website is accessible. The student academy is not activated.

The build has empty Supabase URL and publishable key, with development previews,
registration, submissions, leaderboard and privacy approval flags all `false`.
Grades and private dashboards remain safely unavailable. No hosted Supabase,
Auth URL, SMTP, database, bucket or Edge Function changes were made. No real users,
students or submissions were created.

Before student launch:

1. Review the remaining local MVP source/migrations/functions and their validation
   evidence; prepare its feature-branch commits and PR for owner review separately.
2. Refresh the existing hosted Supabase project identity, migration/schema state
   and recovery inventory, then obtain explicit approval for the precise hosted
   migration/function/configuration changes before executing them.
3. Approve production Auth URL configuration: Site URL
   `https://ianalyze-academy.pages.dev` and Redirect URL
   `https://ianalyze-academy.pages.dev/auth/callback`. The owner previously reported
   `http://localhost:3000` with no redirects; these settings were not changed here.
4. Confirm Brevo transactional sending activation and run an approved controlled
   confirmation/recovery journey using an owner-controlled test inbox, checking
   delivered email, confirmation link, redirects and Brevo logs. SMTP credentials
   must remain outside chat and Git. Saved SMTP settings alone do not prove delivery.
5. Approve bilingual privacy/consent, retention/contact requirements, assignment
   instructions, rubrics and deadlines. Unapproved draft content remains unpublished.
6. Pass hosted role/RLS/private-storage/trusted-upload and Auth end-to-end tests
   within an approved test scope, then separately approve registration or uploads.
   Direct browser uploads must remain closed; trusted upload activation has its
   own server and database gates.
7. Approve a new configured frontend artifact before deployment. Vite environment
   values are build-time inputs; changing Cloudflare variables cannot configure
   this already deployed static bundle.

There is no prior production deployment to roll back to. Preserve the approved
manifest and local artifact; any corrective deployment or removal needs its own
appropriate authorization. Never solve a backend activation failure by opening
registration or weakening RLS/storage policies.
