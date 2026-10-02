-- M7: Singapore home exceptions and backwards-compatible derivative dimensions.
-- No geographic records are inserted and no objects are rewritten.
begin;
create function public.city_is_singapore(p_city_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.cities c join public.countries k on k.id=c.country_id where c.id=p_city_id and k.code='SG');
$$;
revoke all on function public.city_is_singapore(uuid) from public,anon,authenticated;
grant execute on function public.city_is_singapore(uuid) to anon,authenticated;

alter table public.photos drop constraint photo_publish_assignment;
alter table public.photos add constraint photo_publish_assignment check (
  status<>'published' or (context='travel' and location_id is not null) or (context='hotel' and stay_id is not null));
alter table public.stays alter column trip_id drop not null;
alter table public.photos add column derivative_profile smallint not null default 1 check(derivative_profile in (1,2));
grant select(derivative_profile) on public.photos to anon;

-- Cross-record rules cannot be expressed by an ordinary row CHECK.
-- Invoker guards keep direct administrator writes subject to the same rule as forms.
create function public.guard_home_assignment() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_table_name='photos' then
    if new.context='travel' and new.status='published' and new.trip_id is null and
       not exists(select 1 from public.locations l where l.id=new.location_id and public.city_is_singapore(l.city_id)) then
      raise check_violation using message='A Trip is required for photography outside Singapore.';
    end if;
  elsif new.hotel_id is not null and new.trip_id is null and not exists(select 1 from public.hotels h where h.id=new.hotel_id and public.city_is_singapore(h.city_id)) then
    raise check_violation using message='A Trip is required for a Stay outside Singapore.';
  end if;
  return new;
end; $$;
revoke all on function public.guard_home_assignment() from public,anon,authenticated;
create trigger home_photo_assignment before insert or update on public.photos for each row execute function public.guard_home_assignment();
create trigger home_stay_assignment before insert or update on public.stays for each row execute function public.guard_home_assignment();

-- Reject geography edits that would invalidate an existing home assignment.
-- No publication cascades. RLS independently checks current geography on every read.
create function public.guard_home_geography() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.photos p join public.locations l on l.id=p.location_id
    where p.context='travel' and p.status='published' and p.trip_id is null and not public.city_is_singapore(l.city_id)) or
     exists(select 1 from public.stays s join public.hotels h on h.id=s.hotel_id
    where s.trip_id is null and not public.city_is_singapore(h.city_id)) then
    raise check_violation using message='Assign a Trip to dependent home records before moving their geography outside Singapore.';
  end if;
  return null;
end; $$;
revoke all on function public.guard_home_geography() from public,anon,authenticated;
create trigger home_location_geography after update of city_id on public.locations for each statement execute function public.guard_home_geography();
create trigger home_hotel_geography after update of city_id on public.hotels for each statement execute function public.guard_home_geography();
create trigger home_city_geography after update of country_id on public.cities for each statement execute function public.guard_home_geography();
create trigger home_country_geography after update of code on public.countries for each statement execute function public.guard_home_geography();

drop policy public_read on public.photos;
create policy public_read on public.photos for select to anon using (
  status='published' and processing_status='ready' and (
    (context='travel' and exists(select 1 from public.locations l where l.id=photos.location_id and
      ((photos.trip_id is null and public.city_is_singapore(l.city_id)) or
       (photos.trip_id is not null and exists(select 1 from public.trips t where t.id=photos.trip_id))))) or
    (context='hotel' and exists(select 1 from public.stays s where s.id=photos.stay_id))));
drop policy public_read on public.stays;
create policy public_read on public.stays for select to anon using (
  status='published' and exists(select 1 from public.hotels h where h.id=stays.hotel_id and
    ((stays.trip_id is null and public.city_is_singapore(h.city_id)) or
     (stays.trip_id is not null and exists(select 1 from public.trips t where t.id=stays.trip_id)))));

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
  insert into public.hotels(id,name,slug,city_id,brand,address,latitude,longitude,description,rating,recommended_family,recommended_business,recommended_leisure,status,editorial_order)
  values(v_id,p_record->>'name',p_record->>'slug',v_city,p_record->>'brand',p_record->>'address',(p_record->>'latitude')::numeric,(p_record->>'longitude')::numeric,p_record->>'description',(p_record->>'rating')::smallint,coalesce((p_record->>'recommended_family')::boolean,false),coalesce((p_record->>'recommended_business')::boolean,false),coalesce((p_record->>'recommended_leisure')::boolean,false),p_record->>'status',(p_record->>'editorial_order')::integer)
  on conflict(id) do update set name=excluded.name,slug=excluded.slug,city_id=excluded.city_id,brand=excluded.brand,address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude,description=excluded.description,rating=excluded.rating,recommended_family=excluded.recommended_family,recommended_business=excluded.recommended_business,recommended_leisure=excluded.recommended_leisure,status=excluded.status,editorial_order=excluded.editorial_order;
  insert into public.trip_cities(trip_id,city_id) select distinct trip_id,v_city from public.stays where hotel_id=v_id and trip_id is not null on conflict do nothing;
  return v_id;
end; $$;

create or replace function public.admin_save_stay(p_id uuid,p_record jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_hotel public.hotels; v_trip public.trips;
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  if p_record->>'rating' is not null and (p_record->>'rating')::numeric<>trunc((p_record->>'rating')::numeric) then raise check_violation using message='Use whole stars only.'; end if;
  select * into v_hotel from public.hotels where id=(p_record->>'hotel_id')::uuid for update;
  if not found then raise exception 'Select an existing Hotel.'; end if;
  if nullif(p_record->>'trip_id','') is not null then
    select * into v_trip from public.trips where id=(p_record->>'trip_id')::uuid for share;
    if not found then raise exception 'Select an existing Trip.'; end if;
  elsif not public.city_is_singapore(v_hotel.city_id) then
    raise check_violation using message='A Trip is required for a Stay outside Singapore.';
  end if;
  if p_record->>'status'='published' and (v_hotel.status<>'published' or (v_trip.id is not null and v_trip.status<>'published')) then raise exception 'A published Trip and Hotel are required.'; end if;
  if p_id is not null then
    perform id from public.stays where id=p_id for update;
    if not found then raise exception 'This Stay no longer exists.'; end if;
  end if;
  v_id:=coalesce(p_id,gen_random_uuid());
  insert into public.stays(id,hotel_id,trip_id,check_in,check_out,room_type,purpose,rating,review_text,internal_notes,status,editorial_order)
  values(v_id,v_hotel.id,v_trip.id,(p_record->>'check_in')::date,(p_record->>'check_out')::date,p_record->>'room_type',p_record->>'purpose',(p_record->>'rating')::smallint,p_record->>'review_text',p_record->>'internal_notes',p_record->>'status',(p_record->>'editorial_order')::integer)
  on conflict(id) do update set hotel_id=excluded.hotel_id,trip_id=excluded.trip_id,check_in=excluded.check_in,check_out=excluded.check_out,room_type=excluded.room_type,purpose=excluded.purpose,rating=excluded.rating,review_text=excluded.review_text,internal_notes=excluded.internal_notes,status=excluded.status,editorial_order=excluded.editorial_order;
  if v_trip.id is not null then
    insert into public.trip_cities(trip_id,city_id) values(v_trip.id,v_hotel.city_id) on conflict do nothing;
  end if;
  return v_id;
end; $$;

create or replace function public.admin_finalize_photo_import(p_id uuid,p_token uuid,p_metadata jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v public.import_items;
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  select * into v from public.import_items where id=p_id for update;
  if not found then raise exception 'Import item not found.'; end if;
  if v.state='complete' and exists(select 1 from public.photos where id=p_id) then return p_id; end if;
  if v.state<>'processing' or v.claim_token is distinct from p_token or v.lease_until<=now() then raise exception 'Import operation expired.'; end if;
  insert into public.photos(id,filename,storage_key,file_hash,width,height,file_size,classification,context,stay_id,derivative_profile,processing_status,import_batch_id,
    captured_at,captured_at_offset_minutes,latitude,longitude,camera_make,camera_model,lens,focal_length,aperture,shutter_speed,iso)
  values(v.id,v.filename,v.id::text||'/',v.file_hash,(p_metadata->>'width')::integer,(p_metadata->>'height')::integer,v.file_size,v.classification,v.context,v.stay_id,coalesce((p_metadata->>'derivative_profile')::smallint,1),'ready',v.import_batch_id,
    (p_metadata->>'captured_at')::timestamp,(p_metadata->>'captured_at_offset_minutes')::smallint,(p_metadata->>'latitude')::numeric,(p_metadata->>'longitude')::numeric,
    p_metadata->>'camera_make',p_metadata->>'camera_model',p_metadata->>'lens',(p_metadata->>'focal_length')::numeric,(p_metadata->>'aperture')::numeric,p_metadata->>'shutter_speed',(p_metadata->>'iso')::integer);
  update public.import_items set state='complete',stay_id=null,multipart_id=null,claim_token=null,lease_until=null,error=null where id=p_id;
  update public.import_batches set imported=(select count(*) from public.import_items where import_batch_id=v.import_batch_id and state in ('complete','deleted')) where id=v.import_batch_id;
  return p_id;
end; $$;



notify pgrst, 'reload schema';
commit;
