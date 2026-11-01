# Database and authorization

## Tables

| Table                      | Scope and invariants                                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                 | Auth UUID; private contact/registration metadata; E.164 WhatsApp; required fields at registration; server-managed email, consent/registration times and system fields |
| `app_private.user_roles`   | Exactly one Student/Team role per user; no client read/write; signup ignores editable metadata                                                                        |
| `app_private.audit_events` | Controlled role/grade events; no client access; no notebook payload or contact values                                                                                 |
| `academy_weeks`            | Unique weeks 1–6 teaching, 7–8 reserve; bilingual text; draft/published                                                                                               |
| `activities`               | Week relationship, bilingual instructions, deadline (`timestamptz`), positive maximum, publication state                                                              |
| `rubrics`                  | Activity/version uniqueness; create draft first; publication validates criterion total; published versions immutable                                                  |
| `rubric_criteria`          | Ordered bilingual criteria, positive maximum; published criteria immutable                                                                                            |
| `submissions`              | Student/activity/rubric/attempt; generated immutable object path; system timestamps; no client state changes                                                          |
| `grades`                   | Submission/rubric/reviewer/revision; draft or published; immutable through the client API                                                                             |
| `grade_criterion_scores`   | Composite relationships enforce rubric/grade/criterion consistency; atomic save validates range and precision                                                         |

No teaching content, students or confidential documents are seeded. Referential integrity
prevents deleting users with submission history through a casual Auth deletion. Account
erasure/retention needs a separately reviewed owner procedure.

## Access matrix

| Resource                 | Anonymous              | Student                                                                  | Team                                                            |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Profiles/contact         | Denied                 | Own verified profile; whitelisted updates                                | Own profile plus registered students; no editing other profiles |
| Weeks/activities/rubrics | Denied operational API | Published records after registration, including published parent records | Manage content; immutability rules still apply                  |
| Submissions              | Denied                 | Own records; new reservations blocked by upload gate                     | Review metadata/files                                           |
| Grades/criterion scores  | Denied                 | Own published revisions                                                  | Read; save new revisions through controlled RPC                 |
| Roles/audit tables       | Denied                 | Denied                                                                   | Denied                                                          |
| Team materials           | Denied                 | Denied                                                                   | Authenticated private reading                                   |

RLS applies to all ten application tables. Explicit table/column grants protect identity,
roles, grades, consent/registration timestamps and ownership. Public pages continue using
the existing static public content; no public profile/grade projection is introduced.

Role helpers read the current database assignment and verified Auth user, not editable
`user_metadata` or a cached JWT role. Revocation affects subsequent database requests
with the same JWT. Browser role state can remain stale until refresh/token events, but
cannot bypass RLS. Public RPC wrappers are security invokers; privileged implementations
are in the non-exposed schema with fixed empty search paths and restricted EXECUTE grants.
Database operators and secret/service-role credentials remain a trusted privileged boundary.

## Controlled operations

`complete_registration('registration-v1')` checks verified identity and the profile's
required fields, records server timestamps, and performs no approval workflow. The actual
privacy notice and its version must be reviewed before the registration UI is activated.

`save_grade(submission, scores, feedback, publish, expected_revision)` requires Team access,
locks the submission, checks the expected revision, validates criterion membership,
precision, ranges and completeness, and writes a new revision plus its audit event
atomically. Drafts remain hidden. There is no separate leader approval permission.

Published rubric/criterion changes and maximum-score changes after publication are rejected.
The full-stack suite now passes against the local Supabase managed schemas and APIs;
see [validation.md](validation.md) for its exact scope and remaining launch limits.
Embedded tests separately use a small compatibility fixture.

## Storage

- `student-submissions`: private; 256 KiB; notebook/JSON MIME declarations; exact path
  `<student UUID>/<activity UUID>/<submission UUID>/submission.ipynb`.
- `team-materials`: reserved private bucket; 1 MiB; Markdown/PDF; Team read only. No
  document content is included. Any future owner upload needs separate approval.
- Student INSERT requires a matching owned reservation, verified completed registration,
  published activity/rubric, matching object owner and the upload gate.
- `app_private.uploads_enabled()` returns **false**. A reviewed future migration is needed
  to open uploads; there is no browser-settable feature flag.
- No object UPDATE/DELETE policies; no Team-material upload policy. Use authenticated
  downloads. No signed-link issuance or public file route is added.
- Migration preflight refuses existing academy buckets, pre-existing Storage object
  policies or disabled Storage RLS, rather than silently combining unsafe policies.

MIME declarations and extensions do not validate notebook contents. Before uploads are
activated, implement trusted byte/JSON/notebook validation, reject unexpected structures,
and enforce per-user/attempt quotas. Never execute notebooks or render uploaded HTML.

## Retention and free-tier budget

300 students × six notebooks × 256 KiB ≈ **450 MiB** for one retained version each.
Extra attempts, Team materials and downloads consume additional quota. Supabase Free
currently includes a 500 MB database, 1 GB file storage and bandwidth limits; projects
can pause after inactivity. No concurrent-capacity guarantee is made.
[Current limits](https://supabase.com/pricing)

There is no automatic deletion job. Before opening uploads, approve retention/attempt
limits and implement a dry-run orphan report with a grace period. Interrupted/unreferenced
uploads can then be cleaned only through an authorized Storage API process. Reviewed
submissions are excluded from automatic cleanup. Never delete `storage.objects` rows
directly to remove real files; that can leave underlying objects behind.

## Team bootstrap and revocation — future owner operation

After separately approved hosted migration/application and verified account creation:

1. Confirm the exact Auth UUID and verified email in the Dashboard. Public Leaders cards
   and profile metadata never confer access.
2. In an owner-authenticated SQL session, use a transaction to update that user's existing
   `app_private.user_roles` row to `team`, with a meaningful `grant_reason`; verify exactly
   one row changed. No general grant-role RPC is exposed.
3. Verify the audit event and actual Team/Student access using the approved test procedure.
4. Revoke by changing the same assignment to `student` with a reason. Database access
   checks reflect the new role immediately; also arrange session revocation for account
   compromise. Existing downloaded copies cannot be recalled.

This procedure is documented only. No real accounts or role assignments were created.
