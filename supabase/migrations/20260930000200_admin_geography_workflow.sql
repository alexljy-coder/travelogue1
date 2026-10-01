-- Milestone 2: narrow invoker-rights transactions; existing tables/RLS remain unchanged.
-- Apply manually after reviewing migration history. Do not edit the applied foundation.
begin;

create function public.admin_create_city(
  p_name text, p_slug text, p_country_id uuid default null,
  p_country_name text default null, p_country_code text default null,
  p_country_slug text default null, p_latitude numeric default null, p_longitude numeric default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_country uuid; v_city uuid; v_existing_name text;
begin
  if not public.is_admin() then raise insufficient_privilege using message = 'Administrator access required.'; end if;
  if p_country_id is not null then
    select id into v_country from public.countries where id = p_country_id;
    if not found then raise exception 'Select an existing Country.'; end if;
  else
    if exists(select 1 from public.countries where lower(btrim(name))=lower(btrim(p_country_name)) and code<>upper(btrim(p_country_code))) then
      raise exception 'This Country name already exists. Select the existing Country.';
    end if;
    -- Unique code/slug arbitrate concurrent creation. Never overwrite an existing identity.
    insert into public.countries(name,code,slug)
      values (btrim(p_country_name),upper(btrim(p_country_code)),p_country_slug)
      on conflict(code) do nothing returning id into v_country;
    if v_country is null then
      select id,name into v_country,v_existing_name from public.countries where code = upper(btrim(p_country_code));
      if lower(btrim(v_existing_name)) is distinct from lower(btrim(p_country_name)) then
        raise exception 'This Country code already exists. Select the existing Country.';
      end if;
    end if;
  end if;
  insert into public.cities(country_id,name,slug,latitude,longitude)
    values (v_country,btrim(p_name),p_slug,p_latitude,p_longitude)
    on conflict(country_id,slug) do nothing returning id into v_city;
  if v_city is null then
    select id,name into v_city,v_existing_name from public.cities where country_id=v_country and slug=p_slug;
    if lower(btrim(v_existing_name)) is distinct from lower(btrim(p_name)) then
      raise exception 'This City URL name already exists. Select the existing City or use another URL name.';
    end if;
    -- Reuse exact identities, but never silently overwrite existing coordinates.
  end if;
  return v_city;
end;
$$;

create function public.admin_set_trip_city(p_trip_id uuid,p_city_id uuid,p_sequence integer default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_admin() then raise insufficient_privilege using message = 'Administrator access required.'; end if;
  perform id from public.trips where id=p_trip_id for update;
  if not found then raise exception 'This Trip no longer exists.'; end if;
  insert into public.trip_cities(trip_id,city_id,sequence) values(p_trip_id,p_city_id,p_sequence)
    on conflict(trip_id,city_id) do update set sequence=excluded.sequence;
end;
$$;

create function public.admin_remove_trip_city(p_trip_id uuid,p_city_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_admin() then raise insufficient_privilege using message = 'Administrator access required.'; end if;
  perform id from public.trips where id=p_trip_id for update;
  if not found then raise exception 'This Trip no longer exists.'; end if;
  if exists(select 1 from public.trip_locations tl join public.locations l on l.id=tl.location_id where tl.trip_id=p_trip_id and l.city_id=p_city_id)
     or exists(select 1 from public.stays s join public.hotels h on h.id=s.hotel_id where s.trip_id=p_trip_id and h.city_id=p_city_id) then
    raise exception 'This City is used by a Location or Stay in the Trip. Remove those associations first.';
  end if;
  delete from public.trip_cities where trip_id=p_trip_id and city_id=p_city_id;
end;
$$;

create function public.admin_set_trip_location(p_trip_id uuid,p_location_id uuid,p_sequence integer default null,p_visited_at date default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_city uuid;
begin
  if not public.is_admin() then raise insufficient_privilege using message = 'Administrator access required.'; end if;
  -- Lock Location before Trip: same order as Location editing.
  select city_id into v_city from public.locations where id=p_location_id for share;
  if not found then raise exception 'Select an existing Location.'; end if;
  perform id from public.trips where id=p_trip_id for update;
  if not found then raise exception 'This Trip no longer exists.'; end if;
  insert into public.trip_cities(trip_id,city_id) values(p_trip_id,v_city) on conflict do nothing;
  insert into public.trip_locations(trip_id,location_id,sequence,visited_at) values(p_trip_id,p_location_id,p_sequence,p_visited_at)
    on conflict(trip_id,location_id) do update set sequence=excluded.sequence,visited_at=excluded.visited_at;
end;
$$;

create function public.admin_remove_trip_location(p_trip_id uuid,p_location_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_admin() then raise insufficient_privilege using message = 'Administrator access required.'; end if;
  perform id from public.trips where id=p_trip_id for update;
  if not found then raise exception 'This Trip no longer exists.'; end if;
  -- The composite Photo FK prevents unlinking a membership still used by any Photo.
  delete from public.trip_locations where trip_id=p_trip_id and location_id=p_location_id;
  -- Retain explicit City membership; its removal is a separate owner action.
end;
$$;

create function public.admin_save_location(
  p_id uuid,p_city_id uuid,p_name text,p_slug text,
  p_latitude numeric default null,p_longitude numeric default null,p_description text default null,
  p_status text default 'draft',p_editorial_order integer default null,p_trip_id uuid default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise insufficient_privilege using message = 'Administrator access required.'; end if;
  if p_id is null then
    insert into public.locations(city_id,name,slug,latitude,longitude,description,status,editorial_order)
      values(p_city_id,p_name,p_slug,p_latitude,p_longitude,p_description,p_status,p_editorial_order) returning id into v_id;
  else
    perform id from public.locations where id=p_id for update;
    if not found then raise exception 'This Location no longer exists.'; end if;
    -- Lock related Trips in a stable order; mutation RPCs serialize membership changes.
    perform t.id from public.trips t join public.trip_locations tl on tl.trip_id=t.id
      where tl.location_id=p_id order by t.id for update of t;
    update public.locations set city_id=p_city_id,name=p_name,slug=p_slug,latitude=p_latitude,
      longitude=p_longitude,description=p_description,status=p_status,editorial_order=p_editorial_order
      where id=p_id returning id into v_id;
    insert into public.trip_cities(trip_id,city_id)
      select tl.trip_id,p_city_id from public.trip_locations tl where tl.location_id=v_id on conflict do nothing;
    -- Old City memberships remain explicit historical records, not automatically removed.
  end if;
  if p_trip_id is not null then
    perform public.admin_set_trip_location(p_trip_id,v_id);
  end if;
  return v_id;
end;
$$;

create function public.admin_delete_trip(p_trip_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_admin() then raise insufficient_privilege using message = 'Administrator access required.'; end if;
  perform id from public.trips where id=p_trip_id for update;
  if not found then raise exception 'This Trip no longer exists.'; end if;
  if exists(select 1 from public.photos where trip_id=p_trip_id) or exists(select 1 from public.stays where trip_id=p_trip_id) then
    raise exception 'This Trip has Photos or Stays. Keep it, or unpublish it instead.';
  end if;
  -- Explicit confirmed deletion removes ONLY Trip and its joins, never Cities/Locations.
  delete from public.trip_locations where trip_id=p_trip_id;
  delete from public.trip_cities where trip_id=p_trip_id;
  delete from public.trips where id=p_trip_id;
end;
$$;

-- New functions otherwise inherit PUBLIC execution. Keep RPCs admin-only AND under RLS.
revoke all on function public.admin_create_city(text,text,uuid,text,text,text,numeric,numeric) from public,anon,authenticated;
grant execute on function public.admin_create_city(text,text,uuid,text,text,text,numeric,numeric) to authenticated;
revoke all on function public.admin_set_trip_city(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.admin_set_trip_city(uuid,uuid,integer) to authenticated;
revoke all on function public.admin_remove_trip_city(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_remove_trip_city(uuid,uuid) to authenticated;
revoke all on function public.admin_set_trip_location(uuid,uuid,integer,date) from public,anon,authenticated;
grant execute on function public.admin_set_trip_location(uuid,uuid,integer,date) to authenticated;
revoke all on function public.admin_remove_trip_location(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_remove_trip_location(uuid,uuid) to authenticated;
revoke all on function public.admin_save_location(uuid,uuid,text,text,numeric,numeric,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.admin_save_location(uuid,uuid,text,text,numeric,numeric,text,text,integer,uuid) to authenticated;
revoke all on function public.admin_delete_trip(uuid) from public,anon,authenticated;
grant execute on function public.admin_delete_trip(uuid) to authenticated;
commit;
