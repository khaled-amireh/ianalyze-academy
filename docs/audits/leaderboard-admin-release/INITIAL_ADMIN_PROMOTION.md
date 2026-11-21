# Initial Admin promotion — owner-approved AAL2 flow

This procedure is not a migration and has not been executed. The Admin registry remains empty after migrations. Do not grant Admin directly from a service-role SQL session: such a session has no end-user `auth.uid()` or `aal2` assurance.

## Two-stage promotion

1. The owner independently verifies the intended Auth UUID from the approved private source and verifies that it is the existing registered, email-confirmed Student or Team account. A display name or email alone is not an identity binding. The reviewed eligibility correction permits the specifically approved Team owner account without downgrading its existing Team role. TOTP enrollment and the fresh AAL2 challenge are enforced when that account consumes the approval.
2. After separate explicit approval of that exact UUID and reason, a trusted database operator stages a single approval row in `app_private.initial_admin_promotion_approval`. The table is private, RLS-enabled, and writable only by `service_role`. This stages authorization but does not grant Admin access. The owner/operator must not treat the service-role SQL session as the target user's MFA session.
3. Before an approval is staged, the exact owner may enroll and verify a TOTP factor from the Team dashboard. This self-service MFA setup requires the verified owner UUID, Team role, and non-Admin state; it does not create an approval or grant Admin. After deployment, stage the one-time approval and have the owner refresh the Team dashboard. The promotion panel then challenges the verified factor and invokes `public.promote_initial_academy_admin()` only when the approval is pending and the session is AAL2. The RPC verifies that `auth.uid()` matches the staged UUID, rechecks registration, email confirmation, Student-or-Team eligibility, and verified TOTP, requires the Admin registry to be empty, inserts the Admin record with the approved actor/reason, and consumes the approval atomically. Its trigger records the append-only grant event. The existing `user_roles` value is unchanged; Admin is a separate registry assignment.
4. Verify success through a fresh signed-in call to `public.current_academy_is_admin()`; it returns true only for a registry Admin with an AAL2 session. Stop if the session is not AAL2, the target does not match, the approval is missing, or any account/factor condition fails. Do not fall back to direct insertion into `application_admins`.

The staging statement, after the separate owner approval and read-only identity checks, has this shape:

```sql
insert into app_private.initial_admin_promotion_approval
  (singleton, user_id, approved_by, reason)
values
  (true, '<verified-target-auth-uuid>'::uuid,
         '<verified-approver-auth-uuid>'::uuid, '<approved reason>');
```

The service-role SQL editor is used only for that owner-approved staging row; it is never treated as an AAL2 user session and cannot call the promotion RPC. The actual promotion is performed by the intended user under a signature-verified AAL2 JWT. The public RPC is available only through that user's authenticated Academy session; do not emulate `request.jwt.claims` in SQL or put a user token in SQL, command arguments, logs, or files. Never store credentials or real UUIDs in this document, source, or logs.

The feature migration creates the approval table and RPC but does not prepopulate either. Staging and consuming the approval require separate production authorization after all release gates pass.
