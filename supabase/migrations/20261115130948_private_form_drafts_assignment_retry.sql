-- Private unfinished work, separate from finalized application records.
begin;
alter table public.announcements add column version integer not null default 1;
create function app_private.edit_version() returns trigger language plpgsql security invoker set search_path='' as $$ begin new.version=old.version+1; return new; end; $$;
create trigger activity_version before update on public.activities for each row execute function app_private.edit_version();
create trigger announcement_version before update on public.announcements for each row execute function app_private.edit_version();
revoke all on function app_private.edit_version() from public,anon,authenticated;
create table public.form_drafts(
 owner_id uuid not null references public.profiles(id) on delete cascade,
 form_key text not null check(length(form_key) between 1 and 200),
 base_version text not null check(length(base_version)<=500000),
 payload jsonb not null default '{}',
 revision integer not null default 0,
 updated_at timestamptz not null default now(),
 primary key(owner_id,form_key),
 check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=500000)
);
create table app_private.form_cache_keys(
 owner_id uuid primary key references public.profiles(id) on delete cascade,
 secret text not null default (replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''))
);
alter table public.form_drafts enable row level security;
alter table app_private.form_cache_keys enable row level security;
revoke all on public.form_drafts,app_private.form_cache_keys from public,anon,authenticated;
grant select on public.form_drafts to authenticated;
create policy own_form_draft on public.form_drafts for select to authenticated using(owner_id=auth.uid() and app_private.is_verified());
create function app_private.open_form_draft(p_owner uuid,p_form text,p_base text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.form_drafts; secret text;
begin
 if p_owner is distinct from auth.uid() or not app_private.is_verified() then raise exception 'Own verified identity required' using errcode='42501'; end if;
 insert into public.form_drafts(owner_id,form_key,base_version) values(p_owner,p_form,p_base) on conflict do nothing;
 insert into app_private.form_cache_keys(owner_id) values(p_owner) on conflict do nothing;
 select * into result from public.form_drafts where owner_id=p_owner and form_key=p_form;
 select k.secret into secret from app_private.form_cache_keys k where k.owner_id=p_owner;
 return jsonb_build_object('draft',to_jsonb(result),'cache_key',secret);
end; $$;
create function app_private.write_form_draft(p_owner uuid,p_form text,p_base text,p_payload jsonb,p_revision integer) returns integer
language plpgsql security definer set search_path='' as $$
declare next_revision integer;
begin
 if p_owner is distinct from auth.uid() or not app_private.is_verified() then raise exception 'Own verified identity required' using errcode='42501'; end if;
 -- Draft JSON is an application allowlist, never an authentication store.
 if jsonb_typeof(p_payload) is distinct from 'object' or p_payload::text ~* '"(password|confirmation|access_token|refresh_token|authorization|service_role|cache_key)"[[:space:]]*:' then raise exception 'Invalid draft payload' using errcode='22023'; end if;
 update public.form_drafts set payload=p_payload,base_version=p_base,revision=revision+1,updated_at=clock_timestamp()
 where owner_id=p_owner and form_key=p_form and revision=p_revision returning revision into next_revision;
 if not found then raise exception 'Draft changed in another session' using errcode='40001'; end if;
 return next_revision;
end; $$;
create function public.open_form_draft(p_owner uuid,p_form text,p_base text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.open_form_draft(p_owner,p_form,p_base); $$;
create function public.write_form_draft(p_owner uuid,p_form text,p_base text,p_payload jsonb,p_revision integer) returns integer language sql security invoker set search_path='' as $$ select app_private.write_form_draft(p_owner,p_form,p_base,p_payload,p_revision); $$;
revoke all on function app_private.open_form_draft(uuid,text,text),app_private.write_form_draft(uuid,text,text,jsonb,integer),public.open_form_draft(uuid,text,text),public.write_form_draft(uuid,text,text,jsonb,integer) from public,anon,authenticated;
grant execute on function app_private.open_form_draft(uuid,text,text),app_private.write_form_draft(uuid,text,text,jsonb,integer),public.open_form_draft(uuid,text,text),public.write_form_draft(uuid,text,text,jsonb,integer) to authenticated;

-- Retrying a timed-out create request must resolve to the same assignment.
create table app_private.assignment_requests(
 request_id uuid primary key,
 owner_id uuid not null references public.profiles(id),
 activity_id uuid not null references public.activities(id) on delete cascade,
 payload jsonb not null
);
alter table app_private.assignment_requests enable row level security;
revoke all on app_private.assignment_requests from public,anon,authenticated;
create function app_private.save_assignment_retry(p_data jsonb,p_version integer,p_id uuid,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare existing app_private.assignment_requests; result uuid;
begin
 if not app_private.is_team() then raise exception 'Team required' using errcode='42501'; end if;
 if p_id is not null or p_request is null then return app_private.save_assignment(p_data,p_version,p_id); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into existing from app_private.assignment_requests where request_id=p_request;
 if found then
  if existing.owner_id<>auth.uid() then raise exception 'Own request required' using errcode='42501'; end if;
  if existing.payload is distinct from p_data then raise exception 'This request already saved different content' using errcode='40001'; end if;
  return existing.activity_id;
 end if;
 result=app_private.save_assignment(p_data,p_version,null);
 insert into app_private.assignment_requests(request_id,owner_id,activity_id,payload) values(p_request,auth.uid(),result,p_data);
 return result;
end; $$;
drop function public.save_assignment(jsonb,integer,uuid);
create function public.save_assignment(p_data jsonb,p_version integer,p_id uuid default null,p_request uuid default null) returns uuid language sql security invoker set search_path='' as $$ select app_private.save_assignment_retry(p_data,p_version,p_id,p_request); $$;
revoke all on function public.save_assignment(jsonb,integer,uuid,uuid),app_private.save_assignment_retry(jsonb,integer,uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_assignment(jsonb,integer,uuid,uuid),app_private.save_assignment_retry(jsonb,integer,uuid,uuid) to authenticated;
create function app_private.save_criteria_checked(p_rubric_id uuid,p_criteria jsonb,p_snapshot jsonb) returns void language plpgsql security definer set search_path='' as $$
declare current_criteria jsonb;
begin
 if not app_private.is_team() then raise exception 'Team required' using errcode='42501'; end if;
 perform 1 from public.rubrics where id=p_rubric_id for update;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order,c.id),'[]') into current_criteria from public.rubric_criteria c where rubric_id=p_rubric_id;
 if p_snapshot is not null and p_snapshot is distinct from current_criteria then raise exception 'Criteria changed; reload' using errcode='40001'; end if;
 perform app_private.save_draft_rubric(p_rubric_id,p_criteria);
end; $$;
drop function public.save_draft_rubric(uuid,jsonb);
create function public.save_draft_rubric(p_rubric_id uuid,p_criteria jsonb,p_snapshot jsonb default null) returns void language sql security invoker set search_path='' as $$ select app_private.save_criteria_checked(p_rubric_id,p_criteria,p_snapshot); $$;
revoke all on function public.save_draft_rubric(uuid,jsonb,jsonb),app_private.save_criteria_checked(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_draft_rubric(uuid,jsonb,jsonb),app_private.save_criteria_checked(uuid,jsonb,jsonb) to authenticated;
commit;
