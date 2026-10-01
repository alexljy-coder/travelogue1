-- Milestone 6: existing Hotel/Stay model, atomic geography and durable import context.
begin;
alter table public.import_items add column context text not null default 'travel' check(context in ('travel','hotel'));
alter table public.import_items add column stay_id uuid references public.stays(id) on delete restrict;
alter table public.import_items add constraint import_context_shape check(context='hotel' or stay_id is null);
create index import_items_stay_idx on public.import_items(stay_id);

create function public.admin_save_hotel(p_id uuid,p_record jsonb) returns uuid
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
  insert into public.trip_cities(trip_id,city_id) select distinct trip_id,v_city from public.stays where hotel_id=v_id on conflict do nothing;
  return v_id;
end; $$;

create function public.admin_save_stay(p_id uuid,p_record jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_hotel public.hotels; v_trip public.trips;
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  if p_record->>'rating' is not null and (p_record->>'rating')::numeric<>trunc((p_record->>'rating')::numeric) then raise check_violation using message='Use whole stars only.'; end if;
  select * into v_hotel from public.hotels where id=(p_record->>'hotel_id')::uuid for update;
  if not found then raise exception 'Select an existing Hotel.'; end if;
  select * into v_trip from public.trips where id=(p_record->>'trip_id')::uuid for share;
  if not found then raise exception 'Select an existing Trip.'; end if;
  if p_record->>'status'='published' and (v_hotel.status<>'published' or v_trip.status<>'published') then raise exception 'A published Trip and Hotel are required.'; end if;
  if p_id is not null then
    perform id from public.stays where id=p_id for update;
    if not found then raise exception 'This Stay no longer exists.'; end if;
  end if;
  v_id:=coalesce(p_id,gen_random_uuid());
  insert into public.stays(id,hotel_id,trip_id,check_in,check_out,room_type,purpose,rating,review_text,internal_notes,status,editorial_order)
  values(v_id,v_hotel.id,v_trip.id,(p_record->>'check_in')::date,(p_record->>'check_out')::date,p_record->>'room_type',p_record->>'purpose',(p_record->>'rating')::smallint,p_record->>'review_text',p_record->>'internal_notes',p_record->>'status',(p_record->>'editorial_order')::integer)
  on conflict(id) do update set hotel_id=excluded.hotel_id,trip_id=excluded.trip_id,check_in=excluded.check_in,check_out=excluded.check_out,room_type=excluded.room_type,purpose=excluded.purpose,rating=excluded.rating,review_text=excluded.review_text,internal_notes=excluded.internal_notes,status=excluded.status,editorial_order=excluded.editorial_order;
  insert into public.trip_cities(trip_id,city_id) values(v_trip.id,v_hotel.city_id) on conflict do nothing;
  return v_id;
end; $$;

create function public.admin_reserve_context_photo_import(p_id uuid,p_batch_id uuid,p_filename text,p_hash text,p_size bigint,p_classification text,p_context text,p_stay_id uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_exists boolean; v public.import_items;
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  if p_context not in ('travel','hotel') or p_context is null or (p_context='travel' and p_stay_id is not null) then raise exception 'Invalid photo context.'; end if;
  if p_stay_id is not null then
    perform id from public.stays where id=p_stay_id for key share;
    if not found then raise exception 'Select an existing Stay.'; end if;
  end if;
  perform id from public.import_batches where id=p_batch_id for update;
  select exists(select 1 from public.import_items where id=p_id) into v_exists;
  v_id:=public.admin_reserve_photo_import(p_id,p_batch_id,p_filename,p_hash,p_size,p_classification);
  select * into v from public.import_items where id=v_id for update;
  if found then
    if v.state='complete' then
      if exists(select 1 from public.photos where id=v_id and (context<>p_context or stay_id is distinct from p_stay_id)) then raise exception 'These bytes already have another context or Stay. Edit the existing Photo; importing never replaces it.'; end if;
    elsif v.state='failed' and v.stay_id is null and v.context=p_context then
      update public.import_items set stay_id=p_stay_id where id=v_id;
    elsif v_id=p_id and not v_exists then
      update public.import_items set context=p_context,stay_id=p_stay_id where id=v_id;
    elsif v.context<>p_context or v.stay_id is distinct from p_stay_id then
      raise exception 'These bytes already have another context or Stay. Edit the existing Photo; importing never replaces it.';
    end if;
  elsif exists(select 1 from public.photos where id=v_id and (context<>p_context or stay_id is distinct from p_stay_id)) then
    raise exception 'These bytes already have another context or Stay. Edit the existing Photo; importing never replaces it.';
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
  insert into public.photos(id,filename,storage_key,file_hash,width,height,file_size,classification,context,stay_id,processing_status,import_batch_id,
    captured_at,captured_at_offset_minutes,latitude,longitude,camera_make,camera_model,lens,focal_length,aperture,shutter_speed,iso)
  values(v.id,v.filename,v.id::text||'/',v.file_hash,(p_metadata->>'width')::integer,(p_metadata->>'height')::integer,v.file_size,v.classification,v.context,v.stay_id,'ready',v.import_batch_id,
    (p_metadata->>'captured_at')::timestamp,(p_metadata->>'captured_at_offset_minutes')::smallint,(p_metadata->>'latitude')::numeric,(p_metadata->>'longitude')::numeric,
    p_metadata->>'camera_make',p_metadata->>'camera_model',p_metadata->>'lens',(p_metadata->>'focal_length')::numeric,(p_metadata->>'aperture')::numeric,p_metadata->>'shutter_speed',(p_metadata->>'iso')::integer);
  update public.import_items set state='complete',stay_id=null,multipart_id=null,claim_token=null,lease_until=null,error=null where id=p_id;
  update public.import_batches set imported=(select count(*) from public.import_items where import_batch_id=v.import_batch_id and state in ('complete','deleted')) where id=v.import_batch_id;
  return p_id;
end; $$;


-- Successful cleanup releases a temporary Stay dependency; a retry revalidates assignment.
create or replace function public.admin_fail_photo_import(p_id uuid,p_token uuid,p_cleanup_ok boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  update public.import_items set state=case when p_cleanup_ok then 'failed' else 'cleanup_required' end,
    stay_id=case when p_cleanup_ok then null else stay_id end,
    multipart_id=case when p_cleanup_ok then null else multipart_id end,claim_token=null,lease_until=null,
    error=case when p_cleanup_ok then 'Import failed; storage was cleaned. Retry this file.' else 'Storage cleanup is incomplete. Retry cleanup before importing again.' end
    where id=p_id and claim_token=p_token and state in ('preparing','uploading','processing');
  if not found then raise exception 'Import operation changed. Refresh to check its state.'; end if;
end; $$;


-- Tombstones retain operation history without preventing deletion of an unreferenced Stay.
create or replace function public.admin_finish_photo_delete(p_id uuid,p_token uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  perform id from public.import_items where id=p_id and state='deleting' and claim_token=p_token and lease_until>now() for update;
  if not found then raise exception 'Delete operation expired. Retry deletion.'; end if;
  delete from public.photos where id=p_id;
  update public.import_items set state='deleted',stay_id=null,multipart_id=null,claim_token=null,lease_until=null,error=null where id=p_id;
end; $$;
revoke all on function public.admin_save_hotel(uuid,jsonb),public.admin_save_stay(uuid,jsonb),public.admin_reserve_context_photo_import(uuid,uuid,text,text,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_save_hotel(uuid,jsonb),public.admin_save_stay(uuid,jsonb),public.admin_reserve_context_photo_import(uuid,uuid,text,text,bigint,text,text,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
