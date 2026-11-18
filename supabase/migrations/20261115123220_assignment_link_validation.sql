-- Narrow validation correction; no saved records are changed.
begin;
create or replace function app_private.safe_http_links(p_text text) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare link text; parts text[];
begin
 for link in select trim(v) from regexp_split_to_table(coalesce(p_text,''),E'\n') v where trim(v)<>'' loop
  parts=regexp_match(link,'^https?://([A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?|\[([A-Fa-f0-9:]+)\])(?::([0-9]{1,5}))?(?:[/?#][^[:space:]]*)?$','i');
  if parts is null or (parts[3] is not null and parts[3]::integer>65535) then return false; end if;
  if parts[2] is not null then
   begin perform parts[2]::inet; exception when invalid_text_representation then return false; end;
  elsif parts[1] ~ '^[0-9.]+$' and parts[1] like '%.%' then
   begin perform parts[1]::inet; exception when invalid_text_representation then return false; end;
  end if;
 end loop;
 return true;
end; $$;
commit;
