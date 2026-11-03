-- Forward-only validation for new/changed values. No row rewrites or RLS changes.
begin;

create function app_private.normalize_jordanian_mobile(p_phone text) returns text
language plpgsql immutable set search_path = '' as $$
declare compact text;
begin
  if p_phone is null or length(p_phone) > 64 then return null; end if;
  -- Literal ASCII space, NBSP, narrow NBSP, parentheses, dot and hyphen.
  compact := translate(p_phone, ' ' || chr(160) || chr(8239) || '().-', '');
  if compact ~ '^07[789][0-9]{7}$' then return '+962' || substr(compact, 2); end if;
  if compact ~ '^\+9627[789][0-9]{7}$' then return compact; end if;
  if compact ~ '^009627[789][0-9]{7}$' then return '+' || substr(compact, 3); end if;
  return null;
end;
$$;

create function app_private.validate_profile_registration() returns trigger
language plpgsql set search_path = '' as $$
declare normalized text;
begin
  if new.whatsapp is not null and
    (tg_op = 'INSERT' or new.whatsapp is distinct from old.whatsapp) then
    normalized := app_private.normalize_jordanian_mobile(new.whatsapp);
    if normalized is null then
      raise exception 'Valid Jordanian mobile number required' using errcode = '23514';
    end if;
    new.whatsapp := normalized;
  end if;
  if new.academic_year is not null and
    (tg_op = 'INSERT' or new.academic_year is distinct from old.academic_year) and
    new.academic_year not between 1 and 5 then
    raise exception 'Academic year must be between 1 and 5' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function app_private.normalize_jordanian_mobile(text),
  app_private.validate_profile_registration() from public, anon;
grant execute on function app_private.normalize_jordanian_mobile(text) to authenticated;
create trigger profile_registration_validation before insert or update of whatsapp, academic_year
on public.profiles for each row execute function app_private.validate_profile_registration();

commit;
