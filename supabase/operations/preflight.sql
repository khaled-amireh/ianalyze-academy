-- READ ONLY. Confirm the Dashboard project is ocihwiqtgqplwgyhpwjv BEFORE running.
-- No credentials, email addresses, notebook contents or user records are returned.
begin read only;
select current_database() as database_name,current_user as database_role,
  current_setting('server_version') as postgres_version;
select nspname,nspacl from pg_namespace where nspname in ('public','app_private','auth','storage','supabase_migrations');
select to_regclass('supabase_migrations.schema_migrations') as migration_history_table;
do $$ declare r record; begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'No Supabase migration history table exists';
  else
    for r in execute 'select version from supabase_migrations.schema_migrations order by version' loop
      raise notice 'Recorded migration: %',r.version;
    end loop;
  end if;
end; $$;
select n.nspname,c.relname,c.relrowsecurity,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','app_private') and c.relkind in ('r','p','v','m') order by 1,2;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
  where schemaname in ('public','app_private','storage') order by 1,2,3;
select n.nspname,p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','app_private') order by 1,2;
select event_object_schema,event_object_table,trigger_name,action_statement from information_schema.triggers
  where event_object_schema in ('public','app_private','auth') order by 1,2,3;
select grantee,table_schema,table_name,privilege_type from information_schema.table_privileges
  where table_schema in ('public','app_private') and grantee in ('anon','authenticated','service_role') order by 1,2,3,4;
select count(*) as actual_auth_user_count from auth.users;
select id,name,public,file_size_limit,allowed_mime_types from storage.buckets order by id;
select bucket_id,count(*) as object_count from storage.objects group by bucket_id;
rollback;
