-- M7.1: Hotel owns current opinion and photography; Stay is a private/public visit.
-- No object keys/bytes change. Existing Stay reviews/ratings/room/purpose are intentionally discarded.
begin;
alter table public.hotels add column review_text text;
alter table public.hotels add column cover_photo_id uuid references public.photos(id) on delete restrict;
create index hotels_cover_photo_id_idx on public.hotels(cover_photo_id);
grant select(review_text,cover_photo_id) on public.hotels to anon;

-- Withdraw previously hidden Hotel photographs before removing their old visibility parent.
update public.photos p set status='draft',featured=false where p.context='hotel' and p.status='published' and not exists(
 select 1 from public.stays s join public.hotels h on h.id=s.hotel_id
 where s.id=p.stay_id and s.status='published' and h.status='published' and
 ((s.trip_id is null and public.city_is_singapore(h.city_id)) or exists(select 1 from public.trips t where t.id=s.trip_id and t.status='published')));
alter table public.photos add column hotel_id uuid references public.hotels(id) on delete restrict;
alter table public.import_items add column hotel_id uuid references public.hotels(id) on delete restrict;
update public.photos p set hotel_id=s.hotel_id from public.stays s where s.id=p.stay_id;
update public.import_items i set hotel_id=s.hotel_id from public.stays s where s.id=i.stay_id;
alter table public.photos drop constraint photo_context_shape, drop constraint photo_publish_assignment;
drop policy public_read on public.photos;
alter table public.photos drop column stay_id;
alter table public.import_items drop constraint import_context_shape;
alter table public.import_items drop column stay_id;
alter table public.photos add constraint photo_context_shape check (
 (context='travel' and hotel_id is null) or (context='hotel' and trip_id is null and location_id is null));
alter table public.photos add constraint photo_publish_assignment check (
 status<>'published' or (context='travel' and location_id is not null) or (context='hotel' and hotel_id is not null));
alter table public.import_items add constraint import_context_shape check(context='hotel' or hotel_id is null);
create index photos_hotel_id_status_classification_idx on public.photos(hotel_id,status,classification,editorial_order,captured_at desc,created_at desc,id);
create index import_items_hotel_idx on public.import_items(hotel_id);
grant select(hotel_id) on public.photos to anon;
create policy public_read on public.photos for select to anon using (
 status='published' and processing_status='ready' and (
 (context='travel' and exists(select 1 from public.locations l where l.id=photos.location_id and
 ((photos.trip_id is null and public.city_is_singapore(l.city_id)) or
 (photos.trip_id is not null and exists(select 1 from public.trips t where t.id=photos.trip_id))))) or
 (context='hotel' and exists(select 1 from public.hotels h where h.id=photos.hotel_id))));
alter table public.stays drop column rating,drop column review_text,drop column room_type,drop column purpose;

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
  insert into public.trip_cities(trip_id,city_id) select distinct trip_id,v_city from public.stays where hotel_id=v_id and trip_id is not null on conflict do nothing;
  return v_id;
end; $$;

create or replace function public.admin_save_stay(p_id uuid,p_record jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_hotel public.hotels; v_trip public.trips;
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
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
  insert into public.stays(id,hotel_id,trip_id,check_in,check_out,internal_notes,status,editorial_order)
  values(v_id,v_hotel.id,v_trip.id,(p_record->>'check_in')::date,(p_record->>'check_out')::date,p_record->>'internal_notes',p_record->>'status',(p_record->>'editorial_order')::integer)
  on conflict(id) do update set hotel_id=excluded.hotel_id,trip_id=excluded.trip_id,check_in=excluded.check_in,check_out=excluded.check_out,internal_notes=excluded.internal_notes,status=excluded.status,editorial_order=excluded.editorial_order;
  if v_trip.id is not null then
    insert into public.trip_cities(trip_id,city_id) values(v_trip.id,v_hotel.city_id) on conflict do nothing;
  end if;
  return v_id;
end; $$;

drop function public.admin_reserve_context_photo_import(uuid,uuid,text,text,bigint,text,text,uuid);
create or replace function public.admin_reserve_context_photo_import(p_id uuid,p_batch_id uuid,p_filename text,p_hash text,p_size bigint,p_classification text,p_context text,p_hotel_id uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_exists boolean; v public.import_items;
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  if p_context not in ('travel','hotel') or p_context is null or (p_context='travel' and p_hotel_id is not null) then raise exception 'Invalid photo context.'; end if;
  if p_hotel_id is not null then
    perform id from public.hotels where id=p_hotel_id for key share;
    if not found then raise exception 'Select an existing Hotel.'; end if;
  end if;
  perform id from public.import_batches where id=p_batch_id for update;
  select exists(select 1 from public.import_items where id=p_id) into v_exists;
  v_id:=public.admin_reserve_photo_import(p_id,p_batch_id,p_filename,p_hash,p_size,p_classification);
  select * into v from public.import_items where id=v_id for update;
  if found then
    if v.state='complete' then
      if exists(select 1 from public.photos where id=v_id and (context<>p_context or hotel_id is distinct from p_hotel_id)) then raise exception 'These bytes already have another context or Hotel. Edit the existing Photo; importing never replaces it.'; end if;
    elsif v.state='failed' and v.hotel_id is null and v.context=p_context then
      update public.import_items set hotel_id=p_hotel_id where id=v_id;
    elsif v_id=p_id and not v_exists then
      update public.import_items set context=p_context,hotel_id=p_hotel_id where id=v_id;
    elsif v.context<>p_context or v.hotel_id is distinct from p_hotel_id then
      raise exception 'These bytes already have another context or Hotel. Edit the existing Photo; importing never replaces it.';
    end if;
  elsif exists(select 1 from public.photos where id=v_id and (context<>p_context or hotel_id is distinct from p_hotel_id)) then
    raise exception 'These bytes already have another context or Hotel. Edit the existing Photo; importing never replaces it.';
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
  insert into public.photos(id,filename,storage_key,file_hash,width,height,file_size,classification,context,hotel_id,derivative_profile,processing_status,import_batch_id,
    captured_at,captured_at_offset_minutes,latitude,longitude,camera_make,camera_model,lens,focal_length,aperture,shutter_speed,iso)
  values(v.id,v.filename,v.id::text||'/',v.file_hash,(p_metadata->>'width')::integer,(p_metadata->>'height')::integer,v.file_size,v.classification,v.context,v.hotel_id,coalesce((p_metadata->>'derivative_profile')::smallint,1),'ready',v.import_batch_id,
    (p_metadata->>'captured_at')::timestamp,(p_metadata->>'captured_at_offset_minutes')::smallint,(p_metadata->>'latitude')::numeric,(p_metadata->>'longitude')::numeric,
    p_metadata->>'camera_make',p_metadata->>'camera_model',p_metadata->>'lens',(p_metadata->>'focal_length')::numeric,(p_metadata->>'aperture')::numeric,p_metadata->>'shutter_speed',(p_metadata->>'iso')::integer);
  update public.import_items set state='complete',hotel_id=null,multipart_id=null,claim_token=null,lease_until=null,error=null where id=p_id;
  update public.import_batches set imported=(select count(*) from public.import_items where import_batch_id=v.import_batch_id and state in ('complete','deleted')) where id=v.import_batch_id;
  return p_id;
end; $$;

create or replace function public.admin_fail_photo_import(p_id uuid,p_token uuid,p_cleanup_ok boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  update public.import_items set state=case when p_cleanup_ok then 'failed' else 'cleanup_required' end,
    hotel_id=case when p_cleanup_ok then null else hotel_id end,
    multipart_id=case when p_cleanup_ok then null else multipart_id end,claim_token=null,lease_until=null,
    error=case when p_cleanup_ok then 'Import failed; storage was cleaned. Retry this file.' else 'Storage cleanup is incomplete. Retry cleanup before importing again.' end
    where id=p_id and claim_token=p_token and state in ('preparing','uploading','processing');
  if not found then raise exception 'Import operation changed. Refresh to check its state.'; end if;
end; $$;

create or replace function public.admin_finish_photo_delete(p_id uuid,p_token uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  perform id from public.import_items where id=p_id and state='deleting' and claim_token=p_token and lease_until>now() for update;
  if not found then raise exception 'Delete operation expired. Retry deletion.'; end if;
  delete from public.photos where id=p_id;
  update public.import_items set state='deleted',hotel_id=null,multipart_id=null,claim_token=null,lease_until=null,error=null where id=p_id;
end; $$;

create or replace function public.admin_begin_photo_delete(p_id uuid,p_token uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare v public.photos; v_item public.import_items;
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  if p_token is null then raise exception 'Invalid operation token.'; end if;
  select * into v from public.photos where id=p_id for update;
  if not found then raise exception 'Photo not found.'; end if;
  if exists(select 1 from public.trips where cover_photo_id=p_id) or exists(select 1 from public.locations where cover_photo_id=p_id) or exists(select 1 from public.hotels where cover_photo_id=p_id) then raise exception 'Remove this photo from covers before deleting it.'; end if;
  select * into v_item from public.import_items where id=p_id for update;
  if found and v_item.lease_until>now() then raise exception 'This photo has an active operation. Wait before retrying.'; end if;
  insert into public.import_items(id,import_batch_id,filename,file_hash,file_size,classification,state,claim_token,lease_until)
    values(v.id,v.import_batch_id,v.filename,v.file_hash,v.file_size,v.classification,'deleting',p_token,now()+interval '5 minutes')
    on conflict(id) do update set state='deleting',claim_token=p_token,lease_until=now()+interval '5 minutes',error=null;
  -- Withdraw visibility before deleting any bytes. A failed delete stays hidden and retryable.
  update public.photos set status='draft',featured=false,processing_status='failed' where id=p_id;
end; $$;

revoke all on function public.admin_reserve_context_photo_import(uuid,uuid,text,text,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_reserve_context_photo_import(uuid,uuid,text,text,bigint,text,text,uuid) to authenticated;

-- Bounded index cover lookup eliminates one HTTP request per archive entry.
-- Invoker rights: parent and Photo RLS/column grants are respected, never bypassed.
create function public.public_archive_covers(p_parent_ids uuid[],p_kind text)
returns table(parent_id uuid,photo_id uuid) language plpgsql stable security invoker set search_path='' as $$
begin
 if cardinality(p_parent_ids)>12 or p_kind not in ('trip','hotel') or p_kind is null then raise invalid_parameter_value; end if;
 return query
 select t.id,p.id from public.trips t cross join lateral (
  select x.id from public.photos x where x.trip_id=t.id and x.context='travel' and x.classification='nice' and x.status='published'
  order by (x.id=t.cover_photo_id) desc nulls last,x.editorial_order nulls last,x.captured_at desc nulls last,x.created_at desc,x.id limit 1
 ) p where p_kind='trip' and t.id=any(p_parent_ids)
 union all
 select h.id,p.id from public.hotels h cross join lateral (
  select x.id from public.photos x where x.hotel_id=h.id and x.context='hotel' and x.classification='nice' and x.status='published'
  order by (x.id=h.cover_photo_id) desc nulls last,x.editorial_order nulls last,x.captured_at desc nulls last,x.created_at desc,x.id limit 1
 ) p where p_kind='hotel' and h.id=any(p_parent_ids);
end; $$;
revoke all on function public.public_archive_covers(uuid[],text) from public,anon,authenticated;
grant execute on function public.public_archive_covers(uuid[],text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
