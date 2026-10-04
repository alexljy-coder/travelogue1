-- M7.3: remove visit records, preserving Hotels, Photos, imports and all R2 identities.
-- Stay rows (dates/notes/status/Trip relationships) are intentionally discarded.
begin;
create or replace function public.admin_save_hotel(p_id uuid,p_record jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v public.hotels; v_city uuid := (p_record->>'city_id')::uuid;
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  if p_record->>'rating' is not null and (p_record->>'rating')::numeric<>trunc((p_record->>'rating')::numeric) then raise check_violation using message='Use whole stars only.'; end if;
  perform id from public.cities where id=v_city for update;
  if not found then raise exception 'Select an existing City.'; end if;
  if exists(select 1 from public.hotels where city_id=v_city and lower(btrim(name))=lower(btrim(p_record->>'name')) and (p_id is null or id<>p_id)) then raise exception 'This Hotel already exists in this City. Select the existing Hotel.'; end if;
  if p_id is not null then
    select * into v from public.hotels where id=p_id for update;
    if not found then raise exception 'This Hotel no longer exists.'; end if;
  end if;
  v_id := coalesce(p_id,gen_random_uuid());
  if nullif(p_record->>'cover_photo_id','') is not null and not exists(
    select 1 from public.photos where id=(p_record->>'cover_photo_id')::uuid and hotel_id=v_id
    and context='hotel' and classification='nice' and status='published' and processing_status='ready') then
    raise check_violation using message='Choose a Published Nice Hotel photo belonging to this Hotel.';
  end if;
  insert into public.hotels(id,name,slug,city_id,brand,address,latitude,longitude,description,review_text,cover_photo_id,rating,recommended_family,recommended_business,recommended_leisure,status,editorial_order)
  values(v_id,p_record->>'name',p_record->>'slug',v_city,p_record->>'brand',p_record->>'address',(p_record->>'latitude')::numeric,(p_record->>'longitude')::numeric,p_record->>'description',p_record->>'review_text',(p_record->>'cover_photo_id')::uuid,(p_record->>'rating')::smallint,coalesce((p_record->>'recommended_family')::boolean,false),coalesce((p_record->>'recommended_business')::boolean,false),coalesce((p_record->>'recommended_leisure')::boolean,false),p_record->>'status',(p_record->>'editorial_order')::integer)
  on conflict(id) do update set name=excluded.name,slug=excluded.slug,city_id=excluded.city_id,brand=excluded.brand,address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude,description=excluded.description,review_text=excluded.review_text,cover_photo_id=excluded.cover_photo_id,rating=excluded.rating,recommended_family=excluded.recommended_family,recommended_business=excluded.recommended_business,recommended_leisure=excluded.recommended_leisure,status=excluded.status,editorial_order=excluded.editorial_order;
  return v_id;
end; $$;


create or replace function public.admin_remove_trip_city(p_trip_id uuid,p_city_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_admin() then raise insufficient_privilege using message = 'Administrator access required.'; end if;
  perform id from public.trips where id=p_trip_id for update;
  if not found then raise exception 'This Trip no longer exists.'; end if;
  if exists(select 1 from public.trip_locations tl join public.locations l on l.id=tl.location_id where tl.trip_id=p_trip_id and l.city_id=p_city_id) then
    raise exception 'This City is used by a Location in the Trip. Remove those associations first.';
  end if;
  delete from public.trip_cities where trip_id=p_trip_id and city_id=p_city_id;
end;
$$;
create or replace function public.admin_delete_trip(p_trip_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_admin() then raise insufficient_privilege using message = 'Administrator access required.'; end if;
  perform id from public.trips where id=p_trip_id for update;
  if not found then raise exception 'This Trip no longer exists.'; end if;
  if exists(select 1 from public.photos where trip_id=p_trip_id) then
    raise exception 'This Trip has Photos. Keep it, or unpublish it instead.';
  end if;
  -- Explicit confirmed deletion removes ONLY Trip and its joins, never Cities/Locations.
  delete from public.trip_locations where trip_id=p_trip_id;
  delete from public.trip_cities where trip_id=p_trip_id;
  delete from public.trips where id=p_trip_id;
end;
$$;
create or replace function public.guard_home_assignment() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_table_name='photos' then
    if new.context='travel' and new.status='published' and new.trip_id is null and
       not exists(select 1 from public.locations l where l.id=new.location_id and public.city_is_singapore(l.city_id)) then
      raise check_violation using message='A Trip is required for photography outside Singapore.';
    end if;
  end if;
  return new;
end; $$;

create or replace function public.guard_home_geography() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.photos p join public.locations l on l.id=p.location_id
    where p.context='travel' and p.status='published' and p.trip_id is null and not public.city_is_singapore(l.city_id)) then
    raise check_violation using message='Assign a Trip to dependent home records before moving their geography outside Singapore.';
  end if;
  return null;
end; $$;

-- Hotel geography no longer has a Singapore/Trip exception or visit dependency.
drop trigger home_hotel_geography on public.hotels;
drop function public.admin_save_stay(uuid,jsonb);
-- RESTRICT (no CASCADE) catches any unreviewed relational dependency.
drop table public.stays;
notify pgrst,'reload schema';
commit;
