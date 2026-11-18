# Read-only GitHub Actions credential preflight

Prepared locally for owner review. Nothing has been committed, pushed, dispatched,
migrated, or deployed. The existing production workflow is unchanged.

## Review scope

The separate preflight consists of exactly these four proposed files:

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
Project lists, function records, token identifiers/policies and provider errors
remain in memory. They are never included in stdout or the job summary.

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
For the separate approval amendment in step 6, the existing
`docs/final-improvements/approved-changes.json` supports this exact proposed entry
under `files` (not applied by this task):

```json
".github/workflows/credential-preflight.yml": {
  "sha256": "d6d396667acb222092e118e77a9a19eb36dd9698b146da5b29035d391a3715ee",
  "added": true,
  "reason": "Owner-reviewed standalone manual read-only CI credential preflight; no provider mutations or deployment."
}
```

Recompute and review that digest if the workflow changes. Applying the amendment
changes an approval manifest in the historical release set, so record a revised
release fingerprint explicitly rather than claiming that the old content hash
still describes it. The four-file bootstrap itself can run independently of that
later release-preservation amendment.

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
