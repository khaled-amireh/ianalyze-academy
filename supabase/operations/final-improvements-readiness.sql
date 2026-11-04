-- SELECT only. Safe before and after the additive migration; returns no personal data.
select
  exists(select 1 from supabase_migrations.schema_migrations where version='20261104000100') as migration_recorded,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='university') as university_column,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='activities' and column_name='published_at') as activity_publication_column,
  exists(select 1 from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='profiles_zuj_university_id_unique' and i.indisunique and i.indisvalid and i.indpred is not null) as unique_index,
  (select count(*)=2 and bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('announcements','notification_receipts')) as notifications_rls,
  (select count(*)=2 and bool_and(not p.prosecdef and not has_function_privilege('anon',p.oid,'EXECUTE') and has_function_privilege('authenticated',p.oid,'EXECUTE')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('academy_notifications','read_notification')) as notification_rpc_grants,
  (select count(*)=3 from pg_policies where schemaname='public' and policyname in ('announcement_read','announcement_manage','receipt_read') and roles='{authenticated}') as notification_policies;
