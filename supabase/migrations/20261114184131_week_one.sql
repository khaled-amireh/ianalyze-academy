-- Week 1 only. Local migration; hosted application requires owner approval.
begin;

-- Existing assessment tables require scored rubrics and notebook uploads. These
-- ungraded activities deliberately do not enter that workflow or the leaderboard.
create table public.week1_datasets (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  url text not null check (length(url) <= 500 and url ~ '^https://(www\.)?kaggle\.com/datasets/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/?$'),
  topic text not null check (length(trim(topic)) between 1 and 150),
  description text not null check (length(trim(description)) between 1 and 3000),
  column1 text not null check (length(trim(column1)) between 1 and 150),
  column2 text not null check (length(trim(column2)) between 1 and 150),
  column3 text not null check (length(trim(column3)) between 1 and 150),
  question text not null check (length(trim(question)) between 1 and 1000),
  status text not null check (status in ('draft','submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  version integer not null default 1
);
create table public.week1_bingo_boards (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  board_order jsonb not null,
  completed jsonb not null default '[]',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.week1_bingo_claims (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('W1-' || gen_random_uuid()::text),
  student_id uuid not null references public.week1_bingo_boards(student_id) on delete cascade,
  board_snapshot jsonb not null,
  completed_snapshot jsonb not null,
  winning_line jsonb not null,
  challenges jsonb not null,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  check ((status='pending' and reviewed_by is null and reviewed_at is null and rejection_reason is null)
    or (status='verified' and reviewed_by is not null and reviewed_at is not null and rejection_reason is null)
    or (status='rejected' and reviewed_by is not null and reviewed_at is not null and length(trim(rejection_reason)) between 1 and 500))
);
create unique index week1_bingo_active_claim on public.week1_bingo_claims(student_id) where status in ('pending','verified');
create index week1_bingo_claim_time on public.week1_bingo_claims(created_at desc, id);
create table public.week1_session (
  id integer primary key default 1 check (id=1),
  topics jsonb not null,
  version integer not null default 1,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.week1_session(topics) values ('[
 {"id":"1","title_en":"Introduction to Data Science","title_ar":"مقدمة في علم البيانات","description":"","notes":"","links":"","status":"planned"},
 {"id":"2","title_en":"Data Science vs. Data Analysis","title_ar":"علم البيانات مقابل تحليل البيانات","description":"","notes":"","links":"","status":"planned"},
 {"id":"3","title_en":"Why Data Analysis Matters","title_ar":"لماذا تحليل البيانات مهم","description":"","notes":"","links":"","status":"planned"},
 {"id":"4","title_en":"Data Science Life Cycle","title_ar":"دورة حياة علم البيانات","description":"","notes":"","links":"","status":"planned"},
 {"id":"5","title_en":"Introduction to Kaggle","title_ar":"مقدمة في Kaggle","description":"","notes":"","links":"","status":"planned"},
 {"id":"6","title_en":"Finding and Understanding Datasets","title_ar":"البحث عن مجموعات البيانات وفهمها","description":"","notes":"","links":"","status":"planned"},
 {"id":"7","title_en":"Downloading CSV Files","title_ar":"تنزيل ملفات CSV","description":"","notes":"","links":"","status":"planned"},
 {"id":"8","title_en":"Importing CSV into Power BI Desktop","title_ar":"استيراد CSV إلى Power BI Desktop","description":"","notes":"","links":"","status":"planned"}
]');

alter table public.week1_datasets enable row level security;
alter table public.week1_bingo_boards enable row level security;
alter table public.week1_bingo_claims enable row level security;
alter table public.week1_session enable row level security;
revoke all on public.week1_datasets,public.week1_bingo_boards,public.week1_bingo_claims,public.week1_session from public,anon,authenticated;
grant select on public.week1_datasets,public.week1_bingo_boards,public.week1_bingo_claims,public.week1_session to authenticated;
create policy week1_dataset_read on public.week1_datasets for select to authenticated
using (app_private.is_team() or (student_id=(select auth.uid()) and app_private.is_registered()));
create policy week1_board_read on public.week1_bingo_boards for select to authenticated
using (app_private.is_team() or (student_id=(select auth.uid()) and app_private.is_registered()));
create policy week1_claim_read on public.week1_bingo_claims for select to authenticated
using (app_private.is_team() or (student_id=(select auth.uid()) and app_private.is_registered()));
create policy week1_session_read on public.week1_session for select to authenticated using (app_private.is_team());

-- Private definer implementations are needed for protected state transitions.
-- No direct table writes are granted; every entry point checks the existing roles.
create function app_private.week1_save_dataset(p_data jsonb, p_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  if not app_private.is_registered() then raise exception 'Registration required' using errcode='42501'; end if;
  insert into public.week1_datasets as d(student_id,title,url,topic,description,column1,column2,column3,question,status,submitted_at)
  values(auth.uid(),trim(p_data->>'title'),trim(p_data->>'url'),trim(p_data->>'topic'),trim(p_data->>'description'),
    trim(p_data->>'column1'),trim(p_data->>'column2'),trim(p_data->>'column3'),trim(p_data->>'question'),p_data->>'status',
    case when p_data->>'status'='submitted' then now() end)
  on conflict(student_id) do update set title=excluded.title,url=excluded.url,topic=excluded.topic,
    description=excluded.description,column1=excluded.column1,column2=excluded.column2,column3=excluded.column3,
    question=excluded.question,status=excluded.status,submitted_at=excluded.submitted_at,updated_at=now(),version=d.version+1
  where d.version=p_version;
  get diagnostics n=row_count;
  if n<>1 then raise exception 'Content changed; reload before saving' using errcode='40001'; end if;
end; $$;

create function app_private.week1_start_bingo() returns void
language plpgsql security definer set search_path='' as $$
begin
  if not app_private.is_registered() then raise exception 'Registration required' using errcode='42501'; end if;
  insert into public.week1_bingo_boards(student_id,board_order)
  select auth.uid(),jsonb_agg(i order by random()) from generate_series(0,15) i
  on conflict(student_id) do nothing;
end; $$;

create function app_private.week1_mark_bingo(p_challenge integer,p_completed boolean,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare b public.week1_bingo_boards; marks jsonb;
begin
  if not app_private.is_registered() then raise exception 'Registration required' using errcode='42501'; end if;
  select * into b from public.week1_bingo_boards where student_id=auth.uid() for update;
  if not found or b.version<>p_version then raise exception 'Board changed; reload' using errcode='40001'; end if;
  if p_challenge is null or p_challenge not between 0 and 15 or p_completed is null then raise exception 'Invalid challenge' using errcode='22023'; end if;
  if exists(select 1 from public.week1_bingo_claims where student_id=auth.uid() and status in ('pending','verified')) then
    raise exception 'Claim is locked' using errcode='42501'; end if;
  select coalesce(jsonb_agg(v order by v),'[]') into marks from (
    select value::integer as v from jsonb_array_elements_text(b.completed) where value::integer<>p_challenge
    union select p_challenge where p_completed
  ) s;
  update public.week1_bingo_boards set completed=marks,version=version+1,updated_at=now() where student_id=auth.uid();
end; $$;

create function app_private.week1_claim_bingo() returns void
language plpgsql security definer set search_path='' as $$
declare b public.week1_bingo_boards; line jsonb; ids jsonb; candidate jsonb;
begin
  if not app_private.is_registered() then raise exception 'Registration required' using errcode='42501'; end if;
  select * into b from public.week1_bingo_boards where student_id=auth.uid() for update;
  if not found then raise exception 'Start board first' using errcode='22023'; end if;
  if exists(select 1 from public.week1_bingo_claims where student_id=auth.uid() and status in ('pending','verified')) then
    raise exception 'Active or verified claim exists' using errcode='23505'; end if;
  for candidate in select value from jsonb_array_elements('[[0,1,2,3],[4,5,6,7],[8,9,10,11],[12,13,14,15],[0,4,8,12],[1,5,9,13],[2,6,10,14],[3,7,11,15],[0,5,10,15],[3,6,9,12]]'::jsonb) loop
    select jsonb_agg(b.board_order->(value::integer) order by ord) into ids
      from jsonb_array_elements_text(candidate) with ordinality s(value,ord);
    if b.completed @> ids then line=candidate; exit; end if;
  end loop;
  if line is null then raise exception 'No winning line' using errcode='22023'; end if;
  insert into public.week1_bingo_claims(student_id,board_snapshot,completed_snapshot,winning_line,challenges)
  values(auth.uid(),b.board_order,b.completed,line,ids);
end; $$;

create function app_private.week1_review_bingo(p_id uuid,p_status text,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
  if not app_private.is_team() then raise exception 'Team required' using errcode='42501'; end if;
  if p_status is null or p_status not in ('verified','rejected') or
    (p_status='rejected' and (p_reason is null or length(trim(p_reason)) not between 1 and 500)) then
    raise exception 'Invalid review' using errcode='22023'; end if;
  select student_id into sid from public.week1_bingo_claims where id=p_id;
  -- Same lock order as claim/mark prevents races and deadlocks.
  perform 1 from public.week1_bingo_boards where student_id=sid for update;
  update public.week1_bingo_claims set status=p_status,reviewed_by=auth.uid(),reviewed_at=now(),
    rejection_reason=case when p_status='rejected' then trim(p_reason) end
  where id=p_id and status='pending';
  if not found then raise exception 'Claim already reviewed or missing' using errcode='40001'; end if;
end; $$;

create function app_private.week1_save_session(p_topics jsonb,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare item jsonb; link text;
begin
  if not app_private.is_team() then raise exception 'Team required' using errcode='42501'; end if;
  if jsonb_typeof(p_topics) is distinct from 'array' or jsonb_array_length(p_topics)>100 or octet_length(p_topics::text)>500000 then
    raise exception 'Invalid topics' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_topics) loop
    if jsonb_typeof(item) is distinct from 'object' or
      coalesce(length(trim(item->>'id')),0) not between 1 and 100 or
      coalesce(length(trim(item->>'title_en')),0) not between 1 and 200 or
      coalesce(length(trim(item->>'title_ar')),0) not between 1 and 200 or
      coalesce(item->>'status','') not in ('planned','completed') or
      coalesce(length(item->>'description'),10001)>10000 or coalesce(length(item->>'notes'),10001)>10000 or
      coalesce(length(item->>'links'),5001)>5000 then raise exception 'Invalid topic' using errcode='22023'; end if;
    for link in select trim(v) from regexp_split_to_table(item->>'links',E'\n') v where trim(v)<>'' loop
      if link !~ '^https?://[^[:space:]]+$' then raise exception 'Invalid link' using errcode='22023'; end if;
    end loop;
  end loop;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_topics))<>jsonb_array_length(p_topics) then
    raise exception 'Duplicate topic IDs' using errcode='22023'; end if;
  update public.week1_session set topics=p_topics,version=version+1,updated_by=auth.uid(),updated_at=now() where id=1 and version=p_version;
  if not found then raise exception 'Session changed; reload' using errcode='40001'; end if;
end; $$;

create function public.week1_save_dataset(p_data jsonb,p_version integer) returns void language sql security invoker set search_path='' as $$ select app_private.week1_save_dataset(p_data,p_version); $$;
create function public.week1_start_bingo() returns void language sql security invoker set search_path='' as $$ select app_private.week1_start_bingo(); $$;
create function public.week1_mark_bingo(p_challenge integer,p_completed boolean,p_version integer) returns void language sql security invoker set search_path='' as $$ select app_private.week1_mark_bingo(p_challenge,p_completed,p_version); $$;
create function public.week1_claim_bingo() returns void language sql security invoker set search_path='' as $$ select app_private.week1_claim_bingo(); $$;
create function public.week1_review_bingo(p_id uuid,p_status text,p_reason text) returns void language sql security invoker set search_path='' as $$ select app_private.week1_review_bingo(p_id,p_status,p_reason); $$;
create function public.week1_save_session(p_topics jsonb,p_version integer) returns void language sql security invoker set search_path='' as $$ select app_private.week1_save_session(p_topics,p_version); $$;
revoke all on function public.week1_save_dataset(jsonb,integer),public.week1_start_bingo(),public.week1_mark_bingo(integer,boolean,integer),public.week1_claim_bingo(),public.week1_review_bingo(uuid,text,text),public.week1_save_session(jsonb,integer) from public,anon;
revoke all on function app_private.week1_save_dataset(jsonb,integer),app_private.week1_start_bingo(),app_private.week1_mark_bingo(integer,boolean,integer),app_private.week1_claim_bingo(),app_private.week1_review_bingo(uuid,text,text),app_private.week1_save_session(jsonb,integer) from public,anon;
grant execute on function public.week1_save_dataset(jsonb,integer),public.week1_start_bingo(),public.week1_mark_bingo(integer,boolean,integer),public.week1_claim_bingo(),public.week1_review_bingo(uuid,text,text),public.week1_save_session(jsonb,integer) to authenticated;
grant execute on function app_private.week1_save_dataset(jsonb,integer),app_private.week1_start_bingo(),app_private.week1_mark_bingo(integer,boolean,integer),app_private.week1_claim_bingo(),app_private.week1_review_bingo(uuid,text,text),app_private.week1_save_session(jsonb,integer) to authenticated;
commit;
