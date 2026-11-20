# Initial Admin promotion — separate owner action

This SQL is not a migration and has not been executed. The three feature migrations intentionally leave `app_private.application_admins` empty.

Before any Admin grant, the owner must separately approve the specific confirmed, registered Auth user and the grant reason. Verify the target Auth UUID and the approving actor UUID from the approved private source. Do not infer either UUID from an email, display name, fixture, or historical log.

The owner-prepared transaction should follow this shape only after that separate approval:

```sql
begin;
insert into app_private.application_admins (user_id, granted_by, reason)
values ('<verified-target-auth-uuid>'::uuid, '<verified-approver-auth-uuid>'::uuid, '<approved reason>');
commit;
```

The registry insert produces an append-only grant event. Do not place a real user UUID in this candidate template, and do not execute it as part of migration review or deployment.
