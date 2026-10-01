-- Milestone 3: durable per-file recovery, idempotency and bounded operation leases.
-- No applied migration is changed. No public read grants on import state.
begin;
create table public.import_items (
  id uuid primary key,
  import_batch_id uuid references public.import_batches(id) on delete restrict,
  filename text not null check (length(btrim(filename)) between 1 and 255),
  file_hash text not null check (file_hash ~ '^[a-f0-9]{64}$'),
  file_size bigint not null check (file_size between 1 and 26214400),
  classification text not null check (classification in ('nice','record')),
  state text not null default 'reserved' check (state in ('reserved','preparing','uploading','processing','complete','failed','cleanup_required','deleting','deleted')),
  multipart_id text,
  claim_token uuid,
  lease_until timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((claim_token is null) = (lease_until is null))
);
create unique index import_items_active_hash on public.import_items(file_hash) where state <> 'deleted';
create index import_items_batch_idx on public.import_items(import_batch_id);
create trigger set_updated_at before update on public.import_items for each row execute function private.set_updated_at();
alter table public.import_items enable row level security;
revoke all on public.import_items from public,anon,authenticated;
grant select,insert,update,delete on public.import_items to authenticated;
create policy admin_select on public.import_items for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.import_items for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.import_items for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.import_items for delete to authenticated using ((select public.is_admin()));

create function public.admin_create_import_batch(p_id uuid,p_source_name text,p_total integer,p_eligible integer,p_skipped integer)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v public.import_batches;
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  if p_eligible not between 1 and 10 or p_total < p_eligible+p_skipped or p_skipped < 0 then raise exception 'Invalid import counts.'; end if;
  insert into public.import_batches(id,source_name,total_files,eligible_files,skipped_personal,status)
    values(p_id,p_source_name,p_total,p_eligible,p_skipped,'processing') on conflict(id) do nothing;
  select * into v from public.import_batches where id=p_id for update;
  if v.total_files<>p_total or v.eligible_files<>p_eligible or v.skipped_personal<>p_skipped or v.source_name is distinct from p_source_name then raise exception 'Import request identity mismatch.'; end if;
  return p_id;
end; $$;

create function public.admin_reserve_photo_import(p_id uuid,p_batch_id uuid,p_filename text,p_hash text,p_size bigint,p_classification text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v public.import_items; v_capacity integer;
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  select eligible_files into v_capacity from public.import_batches where id=p_batch_id for update;
  if not found then raise exception 'Import batch not found.'; end if;
  select * into v from public.import_items where id=p_id;
  if found then
    if v.file_hash<>p_hash or v.file_size<>p_size or v.classification<>p_classification or v.filename<>p_filename or v.import_batch_id is distinct from p_batch_id then raise exception 'Import request identity mismatch.'; end if;
    if v.state='deleted' then raise exception 'This request was deleted. Select the file again to create a new request.'; end if;
    return v.id;
  end if;
  select id into v_id from public.import_items where file_hash=p_hash and state<>'deleted';
  if found then return v_id; end if;
  select id into v_id from public.photos where file_hash=p_hash order by created_at,id limit 1;
  if found then return v_id; end if;
  if (select count(*) from public.import_items where import_batch_id=p_batch_id)>=v_capacity then raise exception 'This batch has reached its file limit.'; end if;
  begin
    insert into public.import_items(id,import_batch_id,filename,file_hash,file_size,classification)
      values(p_id,p_batch_id,p_filename,p_hash,p_size,p_classification) returning id into v_id;
  exception when unique_violation then
    select id into v_id from public.import_items where file_hash=p_hash and state<>'deleted';
    if not found then raise; end if;
  end;
  return v_id;
end; $$;

create function public.admin_claim_photo_import(p_id uuid,p_token uuid,p_phase text)
returns void language plpgsql security invoker set search_path='' as $$
declare v public.import_items;
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  select * into v from public.import_items where id=p_id for update;
  if not found then raise exception 'Import item not found.'; end if;
  if p_token is null then raise exception 'Invalid operation token.'; end if;
  if p_phase='cancel' then
    if v.state<>'uploading' or v.claim_token is distinct from p_token or v.lease_until<=now() then raise exception 'Upload expired or is already being processed. Retry after its lease expires.'; end if;
    update public.import_items set state='preparing',lease_until=now()+interval '5 minutes' where id=p_id;
  elsif p_phase='process' then
    if v.state<>'uploading' or v.claim_token is distinct from p_token or v.lease_until<=now() then raise exception 'Upload expired or is already being processed. Retry after its lease expires.'; end if;
    update public.import_items set state='processing',lease_until=now()+interval '5 minutes' where id=p_id;
  elsif p_phase in ('prepare','cleanup') then
    if v.state in ('complete','deleted','deleting') then raise exception 'This import cannot be retried.'; end if;
    if v.lease_until>now() then raise exception 'This photo has an active operation. Wait before retrying.'; end if;
    update public.import_items set state='preparing',claim_token=p_token,lease_until=now()+interval '5 minutes',error=null where id=p_id;
  else raise exception 'Invalid operation phase.';
  end if;
end; $$;

create function public.admin_mark_photo_upload(p_id uuid,p_token uuid,p_multipart_id text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  update public.import_items set state='uploading',multipart_id=p_multipart_id,lease_until=now()+interval '10 minutes'
    where id=p_id and claim_token=p_token and state='preparing' and lease_until>now();
  if not found then raise exception 'Import operation expired.'; end if;
end; $$;

create function public.admin_finalize_photo_import(p_id uuid,p_token uuid,p_metadata jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v public.import_items;
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  select * into v from public.import_items where id=p_id for update;
  if not found then raise exception 'Import item not found.'; end if;
  if v.state='complete' and exists(select 1 from public.photos where id=p_id) then return p_id; end if;
  if v.state<>'processing' or v.claim_token is distinct from p_token or v.lease_until<=now() then raise exception 'Import operation expired.'; end if;
  insert into public.photos(id,filename,storage_key,file_hash,width,height,file_size,classification,context,processing_status,import_batch_id,
    captured_at,captured_at_offset_minutes,latitude,longitude,camera_make,camera_model,lens,focal_length,aperture,shutter_speed,iso)
  values(v.id,v.filename,v.id::text||'/',v.file_hash,(p_metadata->>'width')::integer,(p_metadata->>'height')::integer,v.file_size,v.classification,'travel','ready',v.import_batch_id,
    (p_metadata->>'captured_at')::timestamp,(p_metadata->>'captured_at_offset_minutes')::smallint,(p_metadata->>'latitude')::numeric,(p_metadata->>'longitude')::numeric,
    p_metadata->>'camera_make',p_metadata->>'camera_model',p_metadata->>'lens',(p_metadata->>'focal_length')::numeric,(p_metadata->>'aperture')::numeric,p_metadata->>'shutter_speed',(p_metadata->>'iso')::integer);
  update public.import_items set state='complete',multipart_id=null,claim_token=null,lease_until=null,error=null where id=p_id;
  update public.import_batches set imported=(select count(*) from public.import_items where import_batch_id=v.import_batch_id and state in ('complete','deleted')) where id=v.import_batch_id;
  return p_id;
end; $$;

create function public.admin_fail_photo_import(p_id uuid,p_token uuid,p_cleanup_ok boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  update public.import_items set state=case when p_cleanup_ok then 'failed' else 'cleanup_required' end,
    multipart_id=case when p_cleanup_ok then null else multipart_id end,claim_token=null,lease_until=null,
    error=case when p_cleanup_ok then 'Import failed; storage was cleaned. Retry this file.' else 'Storage cleanup is incomplete. Retry cleanup before importing again.' end
    where id=p_id and claim_token=p_token and state in ('preparing','uploading','processing');
  if not found then raise exception 'Import operation changed. Refresh to check its state.'; end if;
end; $$;

create function public.admin_finish_import_batch(p_id uuid,p_failed boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  update public.import_batches set imported=(select count(*) from public.import_items where import_batch_id=p_id and state in ('complete','deleted')),
    status=case when p_failed or exists(select 1 from public.import_items where import_batch_id=p_id and state not in ('complete','deleted')) then 'failed' else 'completed' end where id=p_id;
end; $$;

create function public.admin_begin_photo_delete(p_id uuid,p_token uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare v public.photos; v_item public.import_items;
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  if p_token is null then raise exception 'Invalid operation token.'; end if;
  select * into v from public.photos where id=p_id for update;
  if not found then raise exception 'Photo not found.'; end if;
  if exists(select 1 from public.trips where cover_photo_id=p_id) or exists(select 1 from public.locations where cover_photo_id=p_id) then raise exception 'Remove this photo from covers before deleting it.'; end if;
  select * into v_item from public.import_items where id=p_id for update;
  if found and v_item.lease_until>now() then raise exception 'This photo has an active operation. Wait before retrying.'; end if;
  insert into public.import_items(id,import_batch_id,filename,file_hash,file_size,classification,state,claim_token,lease_until)
    values(v.id,v.import_batch_id,v.filename,v.file_hash,v.file_size,v.classification,'deleting',p_token,now()+interval '5 minutes')
    on conflict(id) do update set state='deleting',claim_token=p_token,lease_until=now()+interval '5 minutes',error=null;
  -- Withdraw visibility before deleting any bytes. A failed delete stays hidden and retryable.
  update public.photos set status='draft',featured=false,processing_status='failed' where id=p_id;
end; $$;

create function public.admin_finish_photo_delete(p_id uuid,p_token uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  perform id from public.import_items where id=p_id and state='deleting' and claim_token=p_token and lease_until>now() for update;
  if not found then raise exception 'Delete operation expired. Retry deletion.'; end if;
  delete from public.photos where id=p_id;
  update public.import_items set state='deleted',multipart_id=null,claim_token=null,lease_until=null,error=null where id=p_id;
end; $$;

create function public.admin_fail_photo_delete(p_id uuid,p_token uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  update public.import_items set claim_token=null,lease_until=null,error='Deletion incomplete. Photo is hidden; retry deletion.' where id=p_id and state='deleting' and claim_token=p_token;
end; $$;

-- New RPCs keep default PUBLIC execution revoked, retain invoker RLS and fixed search paths.
revoke all on function public.admin_create_import_batch(uuid,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.admin_create_import_batch(uuid,text,integer,integer,integer) to authenticated;
revoke all on function public.admin_reserve_photo_import(uuid,uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.admin_reserve_photo_import(uuid,uuid,text,text,bigint,text) to authenticated;
revoke all on function public.admin_claim_photo_import(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_claim_photo_import(uuid,uuid,text) to authenticated;
revoke all on function public.admin_mark_photo_upload(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_mark_photo_upload(uuid,uuid,text) to authenticated;
revoke all on function public.admin_finalize_photo_import(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_finalize_photo_import(uuid,uuid,jsonb) to authenticated;
revoke all on function public.admin_fail_photo_import(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_fail_photo_import(uuid,uuid,boolean) to authenticated;
revoke all on function public.admin_finish_import_batch(uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_finish_import_batch(uuid,boolean) to authenticated;
revoke all on function public.admin_begin_photo_delete(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_begin_photo_delete(uuid,uuid) to authenticated;
revoke all on function public.admin_finish_photo_delete(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_finish_photo_delete(uuid,uuid) to authenticated;
revoke all on function public.admin_fail_photo_delete(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_fail_photo_delete(uuid,uuid) to authenticated;
commit;
