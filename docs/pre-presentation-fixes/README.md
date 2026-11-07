# Presentation fixes — local release review

Baseline: `db4bb8eff14d2120107f756272c07eae4bda1341` (`main`). Work remains local on `fix/pre-presentation-stability-video`; staging is not approval to commit, push, open a PR or deploy.

## Changes

| Problem | Fix |
| --- | --- |
| Footer jumps when a lazy route arrives | Reserve stable main-content space below the existing 70/76px responsive header; retain lazy loading and the approved transition. |
| Mobile LinkedIn/name overlap | Give the link its own mobile caption row with a 44px target and allow long names to wrap; retain portraits, names, links and desktop layout. |
| CSP rejects an inlined font | Emit font files from the same origin; retain the existing CSP, font imports and default handling of non-font assets. |
| Mobile Drive enlargement depends on provider controls | Add a Drive-only expand button, native fullscreen attempt and native modal fallback. Preserve one iframe, aspect ratio, Close/Escape behavior and focus restoration. |

The [approval manifest](approved-changes.json) pins all 16 source/test/check files to their real baseline/current SHA-256 values. Historical manifests and checks remain active. The preservation-script extension validates ancestry, baseline bytes and current bytes before accepting the explicitly listed changes. The artifact check additionally rejects inlined fonts.

Kaggle metadata, URLs, copy and the YouTube rendering branch remain unchanged. The shared component changes only the Drive branch. Authentication, authorization, Supabase, database/migrations, production feature gates, deployment configuration, original assets, Navbar/Footer components, hidden plan and 800ms transition are outside this change.

## Verification snapshot

The completed implementation verification recorded:

- Full `npm run validate`: 56 unit tests and 32 embedded security tests passed, plus TypeScript, lint, formatting, build, artifact, preservation and database-type checks.
- Chrome and Edge: 2,672 public layout observations across 29 targets, all 11 widths, both languages/themes; 176 additional mocked portal observations.
- 316 Drive enlargement cases, 80 accessibility scans, 14 mocked workflow groups and native keyboard/navigation checks.
- Loading reproduction: shift 0.739336 before; maximum 0.000443 across 108 delayed-route cases after, and 0.000111 across 12 full-network stress cases.
- Actual Drive playback advanced through native fullscreen, inline return and enlarged fallback, without another preview document load or replacing the iframe.

These are prior executed browser results, not claims of physical-device testing or live database verification. The staging review reruns the complete validation pipeline from an index-only export without the excluded audit directories. Raw logs, duplicate screenshots, incomplete experiments and long audit reports remain local and are not required test inputs.

Curated, privacy-reviewed illustrations:

- [Cold route before: Footer appears in the first viewport](../audits/fixes-evidence/before-loading-ai-tools-390.png).
- [Cold route after: space reserved for route content](../audits/fixes-evidence/after-loading-ai-tools-390.png).
- [Drive playback in the enlarged landscape fallback](../audits/fixes-evidence/drive-playing-fallback-landscape.png).

The first two are cold-load samples, not final content screenshots; the recorded shift measurements support the stability comparison.

## Reproduce without retained audit artifacts

Use Node 24+, npm 11+ and the lockfile dependencies. From the repository root:

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run validate
node frontend/scripts/pre-presentation-fixture.mjs
```

The fixture builds production mode with synthetic configuration into ignored artifacts and serves GET/HEAD on `127.0.0.1:4193` with the unchanged CSP. It uses no real credentials and keeps submissions/leaderboard closed. Use it only for automated fixtures, not real account login. Nothing is deployed.

From a second terminal at the repository root:

```powershell
node frontend/scripts/pre-presentation-browser-qa.mjs --part=matrix --engine=chrome
node frontend/scripts/pre-presentation-browser-qa.mjs --part=matrix --engine=edge
node frontend/scripts/pre-presentation-browser-qa.mjs --part=video --engine=chrome
node frontend/scripts/pre-presentation-browser-qa.mjs --part=video --engine=edge
node frontend/scripts/pre-presentation-browser-qa.mjs --part=stability --engine=chrome
node frontend/scripts/pre-presentation-browser-qa.mjs --part=stability --engine=edge --throttle=network
node frontend/scripts/pre-presentation-browser-qa.mjs --part=fonts --engine=edge
```

The CDP harness uses the installed Windows Chrome/Edge locations. Its profiles and fixture builds are ignored outputs. Result JSON/screenshots are generated under `docs/audits/fixes-evidence`; they need not exist beforehand or be committed.

Accessibility requires an explicit local axe-core file, rather than an implicit dependency on a discarded audit directory:

```powershell
New-Item -ItemType Directory -Force frontend/artifacts/pre-presentation-fixes/tools | Out-Null
Invoke-WebRequest 'https://cdn.jsdelivr.net/npm/axe-core@4.11.0/axe.min.js' -OutFile frontend/artifacts/pre-presentation-fixes/tools/axe.min.js
$axeFile = (Resolve-Path frontend/artifacts/pre-presentation-fixes/tools/axe.min.js).Path
node frontend/scripts/pre-presentation-browser-qa.mjs --part=accessibility "--axe=$axeFile"
```

Navigation includes a byte-for-byte Kaggle DOM comparison against a baseline server at port 4192. Recreate that baseline from Git, without keeping old screenshots or results as inputs:

```powershell
New-Item -ItemType Directory -Force frontend/artifacts/pre-presentation-baseline | Out-Null
git archive --format=tar --output=frontend/artifacts/pre-presentation-baseline.tar db4bb8eff14d2120107f756272c07eae4bda1341
tar -xf frontend/artifacts/pre-presentation-baseline.tar -C frontend/artifacts/pre-presentation-baseline
New-Item -ItemType Junction -Path frontend/artifacts/pre-presentation-baseline/frontend/node_modules -Target (Resolve-Path frontend/node_modules).Path
Push-Location frontend/artifacts/pre-presentation-baseline/frontend
npm.cmd run build:public
Pop-Location
node frontend/scripts/pre-presentation-fixture.mjs --directory=frontend/artifacts/pre-presentation-baseline/frontend/dist --port=4192
```

Keep both local servers running, then run `node frontend/scripts/pre-presentation-browser-qa.mjs --part=navigation --engine=chrome`. Use fresh ignored baseline directories if already populated; no cleanup or production operation is required. The historical preservation tests need the referenced Git history available in the clone.

## Disclosed limitations

Kaggle remains unavailable and intentionally deferred. Live database/account verification is blocked by unavailable authorized read-only access. No physical Android/iOS, Safari/WebKit or Firefox result is claimed. Chrome and Edge share Chromium. Google can consume Escape inside its iframe; the external Close control remains available. The decorative leaderboard contrast advisory predates these fixes. The candidate is not deployed.
