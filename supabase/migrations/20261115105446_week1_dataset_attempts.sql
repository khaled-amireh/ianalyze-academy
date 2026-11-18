-- Dataset attempts only. Apply to production only after explicit owner approval.
begin;
alter table public.week1_datasets add column id uuid not null default gen_random_uuid();
alter table public.week1_datasets drop constraint week1_datasets_pkey;
alter table public.week1_datasets add primary key(id);
create unique index week1_dataset_one_draft on public.week1_datasets(student_id) where status='draft';
create index week1_dataset_history on public.week1_datasets(student_id,created_at desc,id);
create index week1_dataset_submitted on public.week1_datasets(submitted_at desc,id) where status='submitted';
alter table public.week1_datasets add constraint week1_dataset_submission_time check(status<>'submitted' or submitted_at is not null);

-- A new draft can be blank; submission retains the original required-field limits.
alter table public.week1_datasets drop constraint week1_datasets_title_check,
  drop constraint week1_datasets_url_check, drop constraint week1_datasets_topic_check,
  drop constraint week1_datasets_description_check, drop constraint week1_datasets_column1_check,
  drop constraint week1_datasets_column2_check, drop constraint week1_datasets_column3_check,
  drop constraint week1_datasets_question_check;
alter table public.week1_datasets
  add check(length(title)<=200 and (status='draft' or length(trim(title))>=1)),
  add check(length(url)<=500 and ((status='draft' and url='') or url ~ '^https://(www\.)?kaggle\.com/datasets/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/?$')),
  add check(length(topic)<=150 and (status='draft' or length(trim(topic))>=1)),
  add check(length(description)<=3000 and (status='draft' or length(trim(description))>=1)),
  add check(length(column1)<=150 and (status='draft' or length(trim(column1))>=1)),
  add check(length(column2)<=150 and (status='draft' or length(trim(column2))>=1)),
  add check(length(column3)<=150 and (status='draft' or length(trim(column3))>=1)),
  add check(length(question)<=1000 and (status='draft' or length(trim(question))>=1));

create function app_private.week1_lock_dataset_attempt() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.status='submitted' and new is distinct from old then raise exception 'Submitted attempts are immutable' using errcode='42501'; end if;
 return new;
end; $$;
create trigger week1_dataset_immutable before update on public.week1_datasets for each row execute function app_private.week1_lock_dataset_attempt();

create function app_private.week1_start_dataset_attempt(p_previous_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare existing public.week1_datasets; result uuid;
begin
 if not app_private.is_registered() then raise exception 'Registration required' using errcode='42501'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if p_previous_id is not null and not exists(select 1 from public.week1_datasets where id=p_previous_id and student_id=auth.uid() and status='submitted') then
   raise exception 'Own submitted attempt required' using errcode='42501'; end if;
 select * into existing from public.week1_datasets where student_id=auth.uid() order by (status='draft') desc,created_at desc,id desc limit 1;
 if found then
   if existing.status='draft' or p_previous_id is null then return existing.id; end if;
   if existing.id<>p_previous_id then raise exception 'Attempt changed; reload' using errcode='40001'; end if;
 end if;
 insert into public.week1_datasets(student_id,title,url,topic,description,column1,column2,column3,question,status)
 values(auth.uid(),'','','','','','','','','draft') returning id into result;
 return result;
end; $$;

drop function public.week1_save_dataset(jsonb,integer);
drop function app_private.week1_save_dataset(jsonb,integer);
create function app_private.week1_save_dataset(p_data jsonb,p_version integer,p_attempt_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare existing public.week1_datasets; result uuid; values_json jsonb;
begin
 if not app_private.is_registered() then raise exception 'Registration required' using errcode='42501'; end if;
 if p_version is null or p_version<0 or coalesce(p_data->>'status','') not in ('draft','submitted') then raise exception 'Invalid attempt' using errcode='22023'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if p_attempt_id is null then
   select * into existing from public.week1_datasets where student_id=auth.uid() order by (status='draft') desc,created_at desc,id desc limit 1 for update;
 else
   select * into existing from public.week1_datasets where student_id=auth.uid() and id=p_attempt_id for update;
   if not found then raise exception 'Own attempt required' using errcode='42501'; end if;
 end if;
 values_json=jsonb_build_object('title',trim(p_data->>'title'),'url',trim(p_data->>'url'),'topic',trim(p_data->>'topic'),
   'description',trim(p_data->>'description'),'column1',trim(p_data->>'column1'),'column2',trim(p_data->>'column2'),
   'column3',trim(p_data->>'column3'),'question',trim(p_data->>'question'));
 if existing.id is not null then
   if existing.status='submitted' then
     -- A retry of the same successful request returns the same immutable result.
     if p_data->>'status'='submitted' and to_jsonb(existing) @> values_json then return existing.id; end if;
     raise exception 'Submitted attempts are immutable; start another attempt' using errcode='42501';
   end if;
   if existing.version<>p_version then raise exception 'Attempt changed; reload' using errcode='40001'; end if;
   update public.week1_datasets set title=values_json->>'title',url=values_json->>'url',topic=values_json->>'topic',description=values_json->>'description',
     column1=values_json->>'column1',column2=values_json->>'column2',column3=values_json->>'column3',question=values_json->>'question',
     status=p_data->>'status',submitted_at=case when p_data->>'status'='submitted' then now() end,updated_at=now(),version=version+1
   where id=existing.id returning id into result;
 else
   if p_version<>0 then raise exception 'Attempt changed; reload' using errcode='40001'; end if;
   insert into public.week1_datasets(student_id,title,url,topic,description,column1,column2,column3,question,status,submitted_at)
   values(auth.uid(),values_json->>'title',values_json->>'url',values_json->>'topic',values_json->>'description',values_json->>'column1',values_json->>'column2',values_json->>'column3',values_json->>'question',p_data->>'status',case when p_data->>'status'='submitted' then now() end)
   returning id into result;
 end if;
 return result;
end; $$;
create function public.week1_save_dataset(p_data jsonb,p_version integer,p_attempt_id uuid default null) returns uuid language sql security invoker set search_path='' as $$ select app_private.week1_save_dataset(p_data,p_version,p_attempt_id); $$;
create function public.week1_start_dataset_attempt(p_previous_id uuid default null) returns uuid language sql security invoker set search_path='' as $$ select app_private.week1_start_dataset_attempt(p_previous_id); $$;
revoke all on function app_private.week1_lock_dataset_attempt(),app_private.week1_start_dataset_attempt(uuid),public.week1_start_dataset_attempt(uuid),app_private.week1_save_dataset(jsonb,integer,uuid),public.week1_save_dataset(jsonb,integer,uuid) from public,anon;
grant execute on function app_private.week1_start_dataset_attempt(uuid),public.week1_start_dataset_attempt(uuid),app_private.week1_save_dataset(jsonb,integer,uuid),public.week1_save_dataset(jsonb,integer,uuid) to authenticated;
-- Existing RLS ownership and team checks, table grants, profiles and roles stay intact.
commit;
