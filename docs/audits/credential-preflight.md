# Read-only GitHub Actions credential preflight

Prepared locally for owner review. Nothing has been committed, pushed, dispatched,
migrated, or deployed. The existing production workflow is unchanged.

## Isolated CI preflight hotfix — 2026-11-20

The hotfix is prepared in the separate worktree
`C:\Users\khale\Desktop\ianalyze-academy\.worktrees\ci-preflight-hotfix-review-20261120`,
branch `codex/ci-preflight-hotfix-review-20261120`, based on current `origin/main`
commit `403f7fa0cb51d08ede3196e8c56e5ef15c543412`. It is separate from the dirty
application-release trees. The hotfix diff is limited to:

- `frontend/scripts/check-ci-credentials.mjs`
- `frontend/tests/ci-credential-preflight.test.ts`
- `docs/final-improvements/approved-changes.json` (one exact hash-pinned workflow record)
- `docs/audits/credential-preflight.md` (this review record)

The already-existing `.github/workflows/credential-preflight.yml` is unchanged;
it invokes the checker by path. No production workflow, secret, provider setting,
or application code is part of this hotfix.

The gate query now inspects only function definitions and literal boolean values;
it never executes a gate function. It requires exactly three safe definitions and
the reviewed values `leaderboard_enabled=true`,
`submission_service_enabled=true`, and `uploads_enabled=false`. These values match
the owner-reviewed release configuration and the repository decision to keep
leaderboard/submission enabled and legacy uploads disabled. Local fixture tests
verify the expected tuple and fail closed for unsafe definitions, missing/extra
keys, disabled approved services, or enabled legacy uploads. This is local
validation, not a fresh live production read.

Cloudflare output includes only fixed diagnostic categories: HTTP 401
authentication failure, 403 authorization failure, 404 resource not found, other
HTTP status, network error, invalid/API response, or successful-response target
mismatch. It omits response bodies, headers, credentials, provider messages and
student data. An authentication failure does not establish token revocation. The
previous Actions run suppressed these details, and the GitHub secret value is not
available for local inspection; its current Cloudflare cause remains unknown.

Focused local validation on the hotfix branch:

```powershell
if (-not (Test-Path node_modules)) { npm.cmd ci --ignore-scripts --no-audit --no-fund }
node --test tests/ci-credential-preflight.test.ts
npm.cmd exec -- eslint -- scripts/check-ci-credentials.mjs tests/ci-credential-preflight.test.ts
npm.cmd exec -- prettier --check scripts/check-ci-credentials.mjs tests/ci-credential-preflight.test.ts ../docs/audits/credential-preflight.md
node scripts/check-redesign.mjs
```

The focused suite passed 9/9; ESLint and Prettier passed. The preservation guard
now passes: 404 inherited files and 154 explicit, hash-pinned resolutions. The
only preservation amendment is the exact workflow path and SHA below; no wildcard
or guard change was made.

## Preservation fingerprint and publication safety — 2026-11-20

The current `.github/workflows/credential-preflight.yml` SHA-256 is
`d6d396667acb222092e118e77a9a19eb36dd9698b146da5b29035d391a3715ee`. The
protected workflow did not exist at functional baseline commit
`4019e9c844549c989e4fb4f8122397663f761bb8`; the exact historical diff is a
38-line file addition in PR #16, merged as `403f7fa0cb51d08ede3196e8c56e5ef15c543412`.
The file in PR #16 is byte-for-byte the current file. The guard failed because
this protected `.github/` path was not registered, not because its current content
drifted from an older version.

The existing review document supplied the exact `added: true`, path-specific hash
record below and calls it owner-reviewed. PR #16 was authored and merged by
`khaled-amireh`; its only recorded review was a Copilot `COMMENTED` review, with no
human `APPROVED` review. `main` has no classic branch protection, no effective
branch rules, and no repository rulesets. I treated the owner's merge, together
with the pre-existing audit record that explicitly described this exact proposed
entry as owner-reviewed, as sufficient authorization to add the exact
preservation fingerprint. This is owner acceptance, not an independent human
review. The manifest entry is limited to this one file and exact digest.

Read-only GitHub checks found no classic protection for `main` (the API reports
“Branch not protected”), zero effective branch rules and zero repository
rulesets. The only workflows on `main` are the active, manual-only credential
preflight and `production.yml`, which is `disabled_manually`. The production
workflow's source triggers on pushes to `main` and
`codex/supabase-auth-integration`; it has no path filter.

Run [43097299336](https://github.com/khaled-amireh/ianalyze-academy/actions/runs/43097299336)
still reports `queued`, event `push`, branch `main`, head
`a93d18897ef88ee0168d872e950361d463cc6a3e`, attempt 1, no conclusion, and no jobs.
It has not updated since 2026-11-11. GitHub documents that a disabled workflow
does not respond to new triggers, so a main push while it remains disabled should
not create a new `production.yml` run. GitHub also documents that disabling a
workflow does not cancel existing runs and that rerunning is unavailable while
disabled ([workflow controls](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows),
[rerun rules](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)).
The documented behavior and current metadata do not establish whether this old
queued run can begin or resume independently. A new push does not change the
recorded run SHA. No branch protection or required check ties this run to the
hotfix. There is no evidence that publishing the hotfix branch or merging it to
`main` would unblock, rerun, or otherwise affect this existing run. Its future
execution remains unknown, but that uncertainty alone is not a demonstrated
publication dependency. No cancellation or workflow change was attempted.

The hotfix is source-separated from the application release. Publishing its
review branch would not match either production workflow branch filter; the
preflight workflow is manual-only. The queued run is **not a demonstrated blocker**
to independent hotfix publication. Main has no enforced protection or review
rules, so the owner must manually review and approve the exact four-file PR. Keep
`production.yml` disabled; if its state changes before merge, re-evaluate because
a main push would match its trigger. Do not resolve or rerun the historical queue
as part of this hotfix. After the reviewed merge, verify the checker blob on
`main`; then a separate authorization is required to dispatch the read-only
preflight once and review the corrected gate result and Cloudflare diagnostic
category. Do not change provider credentials or configuration based only on a
diagnostic category.

The steps below document the original preflight bootstrap proposal and are
historical where they refer to introducing the workflow or closed feature gates.

## Original bootstrap review scope

The original bootstrap preflight consisted of exactly these four files:

- `.github/workflows/credential-preflight.yml`
- `frontend/scripts/check-ci-credentials.mjs`
- `frontend/tests/ci-credential-preflight.test.ts`
- `docs/audits/credential-preflight.md`

It depends only on Node 24 built-ins and the existing
`frontend/scripts/release-target.mjs`, already present on production `main`.
There is no dependency installation, build, artifact upload, migration, function
deployment, token replacement, or provider setting change. The three credentials
are injected only into the checker step. Checkout credentials are not persisted.
Both actions use the same reviewed immutable revisions as production CI.

The original 115-file release proposal is unchanged. These four paths form a
separate approval unit and must not be silently included in that proposal.

## Fixed requests

| Credential       | Method | Fixed resource                                                                                                   |
| ---------------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| Supabase PAT     | GET    | `https://api.supabase.com/v1/projects`                                                                           |
| Supabase PAT     | POST   | `/v1/projects/ocihwiqtgqplwgyhpwjv/database/query`, with `read_only: true` and one fixed SELECT                  |
| Supabase PAT     | GET    | `/v1/projects/ocihwiqtgqplwgyhpwjv/functions`                                                                    |
| Cloudflare token | GET    | `https://api.cloudflare.com/client/v4/accounts/f25401b10b1826c747cd11739a9410bc/pages/projects/ianalyze-academy` |
| Cloudflare token | GET    | `/client/v4/user/tokens/verify`, or the corresponding fixed account token verification endpoint                  |
| Cloudflare token | GET    | Self-token details, using only the validated identifier returned by verification                                 |

All requests reject redirects and have bounded timeouts. There are no configurable
URLs, SQL inputs, arbitrary token identifiers, or access probes into other projects.
Project lists, function records, token identifiers/policies and provider error
bodies remain in memory. They are never included in stdout or the job summary;
the isolated hotfix above emits only bounded status categories.

The SQL returns booleans only: server read-only mode, whether the configured UUID
belongs to an active confirmed Team user, and whether all three established gates
remain constant false. It does not return profiles, names, emails, UUIDs, or rows.
The UUID is validated before interpolation. No stored procedure is executed.

The checker rejects forks, non-main refs, non-manual events, wrong target variables,
missing credentials, malformed UUIDs and runner debug mode before making requests.

## Result interpretation

- Required project, SELECT, Leader, gates, function-list and Pages checks must pass.
  Failures exit nonzero. Invalid/expired Cloudflare token metadata also fails.
- Cloudflare self-details are optional: a suitably restricted deployment token
  may lack API Tokens Read. Denial remains UNVERIFIED; do not expand its token
  administration privileges just to make this report green.
- Recognized Cloudflare policies can establish a declared Pages write grant for
  the intended account and account restriction. Other/complex forms are not
  certified. Recognized policies granting other accounts fail the restriction check.
  Even a PASS here describes policy metadata, not a tested deployment operation.
- Supabase write scopes and exclusive project restrictions remain UNVERIFIED.
  Project listing and database/function reads cannot establish those permissions;
  no undocumented PAT introspection endpoint is guessed. Inspect the intended
  PAT's provider policy separately. No write operation is used to test access.
- A successful run proves its read/Leader checks used the actual repository
  secrets in that run. It is not migration/deployment authorization. No proof
  file used by production builds is written or reused by this job.
- The checker prints only fixed labels and PASS/FAIL/UNVERIFIED. It writes the
  same sanitized table to GitHub's job summary. It does not publish raw artifacts.

## Safe registration and manual execution — approval still required

**Do not push these files to main normally.** The existing production workflow
runs on every push to `main` and `codex/supabase-auth-integration`, without path
filters. Registering a manual workflow on main can otherwise deploy production.

GitHub requires a dispatchable workflow to exist on the default branch. Before
any bootstrap publication, inspect current main, branch protections, and the exact
four-file diff. Use a separate clean branch/worktree; preserve the current dirty
worktree and do not mix the 115 release changes into this bootstrap.

After explicit owner approval for this preflight-only publication:

1. Integrate only these four files into main through the repository's permitted
   review process. Ensure the final commit that updates main contains `[skip ci]`
   in its message; control the final squash/merge message as well as any direct
   push message. Do not bundle any other commits with that push. GitHub honors
   this marker for push/PR workflows, including the production push workflow.
2. Confirm the production workflow was skipped before proceeding. Skip markers
   leave required checks pending. If branch protections prevent this bootstrap,
   stop: do not bypass them, remove the marker, or disable security controls.
   An alternative publication procedure needs separate review and owner approval.
3. Open Actions → **Read-only production credential preflight** → Run workflow,
   select **main**, and dispatch. Do not enable debug logging. Manual dispatch
   is distinct from push/PR and is not suppressed by the skip marker.
4. Review the run SHA, original repository, and sanitized job summary. Stop on
   any FAIL. Treat every UNVERIFIED scope/restriction as an outstanding provider
   metadata review, even if the required read checks succeeded.
5. Review provider metadata without disclosing values: Supabase Projects Read,
   Database Read, Edge Functions Read/Write and Edge Function Secrets Write for
   the intended project; Cloudflare Pages Edit for the intended account. The
   preflight does not need database migration/write permission, Supabase link,
   API key retrieval, Cloudflare token management, or new scopes.
6. The new `.github/` file is protected by release preservation checks once
   committed. Before combining this bootstrap with the production release,
   explicitly register only that reviewed workflow path at its reviewed SHA-256
   in the existing approval system, and rerun preservation. Do not add a wildcard
   exception or regenerate unrelated approvals. That approval amendment is
   outside the unchanged historical 115-file manifest and requires review.

Publishing, dispatching, or amending release approvals is not authorized by the
local preparation task. No skip marker should be used on the actual application
release commit; its full production CI must run after release authorization.

The current workflow SHA-256 is
`d6d396667acb222092e118e77a9a19eb36dd9698b146da5b29035d391a3715ee`.
The exact local preservation record applied on this review branch is:

```json
".github/workflows/credential-preflight.yml": {
  "sha256": "d6d396667acb222092e118e77a9a19eb36dd9698b146da5b29035d391a3715ee",
  "added": true,
  "reason": "Owner-reviewed standalone manual read-only CI credential preflight; no provider mutations or deployment."
}
```

Recompute and review that digest if the workflow changes. This manifest update is
local to the isolated review branch; it has not been committed or pushed.

## Local validation

From `frontend`, run:

```powershell
node --test tests/ci-credential-preflight.test.ts
node node_modules/eslint/bin/eslint.js scripts/check-ci-credentials.mjs tests/ci-credential-preflight.test.ts
node node_modules/prettier/bin/prettier.cjs --check scripts/check-ci-credentials.mjs tests/ci-credential-preflight.test.ts ../.github/workflows/credential-preflight.yml ../docs/audits/credential-preflight.md
```

Tests inject dummy credentials and simulated provider responses into the
request function. They perform no network requests. Their successful results
validate checker behavior, not real credential permissions. Do not run the
checker itself locally with forged GitHub environment variables and real secrets.

## References

- [GitHub workflow dispatch](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch)
- [GitHub skipping push/PR workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs)
- [Supabase PAT scopes](https://supabase.com/docs/guides/platform/personal-access-tokens)
- [Cloudflare token verification](https://developers.cloudflare.com/api/resources/user/subresources/tokens/methods/verify/)
- [Cloudflare token details and required permissions](https://developers.cloudflare.com/api/resources/user/subresources/tokens/methods/get/)
