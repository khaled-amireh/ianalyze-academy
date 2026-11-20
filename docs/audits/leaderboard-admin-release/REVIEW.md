# Consolidated candidate review

**Current update:** Final local blocker resolution is recorded in [FINAL_READINESS.md](FINAL_READINESS.md). Its status supersedes the historical remaining-work list below. Real local Auth/API/Chrome integration and synthetic recovery have now been verified. Production-only evidence remains gated.

Snapshot: 2026-11-20 (Asia/Amman). Branch `release/academy-admin-consent-20261119`, HEAD `b57a26d7eac32004110b0d5aef4a18f6b94281bf`. Local uncommitted candidate; no staging, commits, pushes, merges, production writes or deployment.

## Consolidation

Retain only `20261119170000_leaderboard_name_consent.sql`, `20261119170100_application_admins.sql`, and `20261119170200_admin_manual_point_awards.sql` as new migrations. The separate name-review tree and its competing `20261119024031` migration remain untouched; never apply both consent implementations. Existing 17 applied migrations must not be replayed.

The Admin candidate supplies generated publication names, retained aliases, audited consent and independent Admin authority/award ledger. The separate name-review supplies registered-name edit protection, bilingual privacy disclosures and active-gate-compatible registration verification. Trusted corrections revoke consent; students must opt in again. Publication choices are excluded from form-draft persistence. Manual points remain server-authorized, append-only and idempotent; archive original standings now include manual awards earned before cutoff. No account promotion or real award was performed.

Existing exact approval records contain current reviewed fingerprints; original base commits and previous-hash fields remain intact. New migrations are individually hash-pinned. `candidate-manifest.json` records the consolidated source fingerprints. Guard algorithms and workflow approvals remain unchanged.

## Automation and recovery

Mandatory embedded validation now includes consent/Admin regressions. The database type generator derives named table-returning RPC rows from PostgreSQL metadata. Registration proof v2 checks safe constant definitions and exact approved feature states, allowing already-enabled services without opening legacy uploads.

`frontend/scripts/backup-freshness.mjs` separates exact recovery freshness from risk-based preservation. The repaired verifier is retained at `frontend/scripts/verify-current-release-prerequisites.mjs` and in the existing ignored local evidence directory. It reports actual changed tables and stops when a fresh backup is required. The source verifier uses existing local recovery helpers/evidence under `frontend/artifacts/`; it was not executed against production. Run from the repository root with `node frontend/scripts/verify-current-release-prerequisites.mjs` only in a separately authorized, privately authenticated verification session. Its historical Week 1 bundle check is not approval of this new candidate manifest.

## Validation

Executed from this candidate: `npm.cmd --prefix frontend run release:check`.

The complete `validate` stage passed: TypeScript, ESLint, frontend tests 115/115, formatting, public build, production boundary, Pages artifact, Phase 02, redesign/preservation, Phase 03, embedded PostgreSQL/security tests 54/54, and migration-derived database type equality. `git diff --check` passed. Guard reports 404 inherited files and 172 exact pinned resolutions. No dependency pins or lockfile changes.

The subsequent configured production build failed closed: verified production URL and browser-safe publishable key are unavailable in this execution environment. Therefore `release:check` as a whole has NOT passed. Details: `frontend/artifacts/consolidated-release-check.log` (local ignored log).

## Remaining production-review requirements

- Provide the approved production build configuration privately, obtain fresh registration-readiness proof and run the configured build/artifact checks with the intended feature approvals. No fabricated proof or reused expired evidence.
- Perform authenticated browser/API integration against an isolated local Supabase stack; the current run used embedded PostgreSQL fixtures, not live GoTrue/PostgREST/Storage or authenticated browser sessions.
- Refresh encrypted backup, isolated restore, portable recovery and independently verified offsite evidence. Existing backup is stale; no recovery cycle was performed here.
- Revalidate production migration/catalog/grant/RLS drift, enabled feature gates, provider revocations, disabled workflow/queued run and Cloudflare deployment activity before separately authorized writes. Private backup-table advisory remains an explicitly reviewed production concern.
- Review exact new migration manifest and separate audited account-promotion operation. No production execution is authorized by this document.
