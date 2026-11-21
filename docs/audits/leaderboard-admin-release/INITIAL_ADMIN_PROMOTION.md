# Initial Admin promotion — owner-approved AAL2 flow

This procedure is not a migration and has not been executed. The Admin registry remains empty after migrations. Do not grant Admin directly from a service-role SQL session: such a session has no end-user `auth.uid()` or `aal2` assurance.

## Two-stage promotion

1. The owner independently verifies the intended Auth UUID from the approved private source and verifies that it is the existing registered/email-confirmed student account. A display name or email alone is not an identity binding. TOTP enrollment and the fresh AAL2 challenge are enforced when that account consumes the approval.
2. After separate explicit approval of that exact UUID and reason, a trusted database operator stages a single approval row in `app_private.initial_admin_promotion_approval`. The table is private, RLS-enabled, and writable only by `service_role`. This stages authorization but does not grant Admin access. The owner/operator must not treat the service-role SQL session as the target user's MFA session.
3. The intended account signs into the Academy and opens its Student dashboard. The candidate's target-only promotion panel appears only when the signed-in UUID matches the staged approval. It guides the user through TOTP enrollment when needed or a challenge for an existing verified factor, then invokes `public.promote_initial_academy_admin()` through the authenticated Supabase client. The RPC requires the signed JWT claim `aal = 'aal2'`, verifies that `auth.uid()` matches the staged UUID, rechecks registration, email confirmation and verified TOTP, requires the Admin registry to be empty, inserts the Admin record with the approved actor/reason, and consumes the approval atomically. Its trigger records the append-only grant event.
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
