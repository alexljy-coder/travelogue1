-- V1 foundation. Atomic schema + grants + RLS: no unprotected intermediate state.
-- Never run against an uninspected existing database. See docs/supabase-setup.md.
begin;
revoke create on schema public from public, anon, authenticated;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.admin_identity (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete restrict
);
alter table private.admin_identity enable row level security;
revoke all on private.admin_identity from public, anon, authenticated;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from private.admin_identity where user_id = (select auth.uid())); $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

create table public.countries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  code text not null unique check (code ~ '^[A-Z]{2}$'),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete restrict,
  name text not null check (length(btrim(name)) > 0),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  latitude numeric check (latitude between -90 and 90),
  longitude numeric check (longitude between -180 and 180),
  check ((latitude is null) = (longitude is null)),
  created_at timestamptz not null default now(),
  unique(country_id,slug)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete restrict,
  name text not null check (length(btrim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  latitude numeric check (latitude between -90 and 90),
  longitude numeric check (longitude between -180 and 180),
  check ((latitude is null) = (longitude is null)),
  description text,
  cover_photo_id uuid,
  status text not null default 'draft' check (status in ('draft','published')),
  editorial_order integer check (editorial_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.locations for each row execute function private.set_updated_at();

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  start_date date,
  end_date date,
  check (start_date is null or end_date is null or end_date >= start_date),
  purpose text check (purpose in ('leisure','business','family','photography','mixed')),
  description text,
  cover_photo_id uuid,
  status text not null default 'draft' check (status in ('draft','published')),
  editorial_order integer check (editorial_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.trips for each row execute function private.set_updated_at();

create table public.trip_cities (
  trip_id uuid not null references public.trips(id) on delete restrict,
  city_id uuid not null references public.cities(id) on delete restrict,
  sequence integer check (sequence >= 0),
  primary key(trip_id,city_id)
);

create table public.trip_locations (
  trip_id uuid not null references public.trips(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  sequence integer check (sequence >= 0),
  visited_at date,
  primary key(trip_id,location_id)
);

create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  brand text,
  city_id uuid not null references public.cities(id) on delete restrict,
  address text,
  latitude numeric check (latitude between -90 and 90),
  longitude numeric check (longitude between -180 and 180),
  check ((latitude is null) = (longitude is null)),
  description text,
  rating smallint check (rating between 1 and 5),
  recommended_family boolean not null default false,
  recommended_business boolean not null default false,
  recommended_leisure boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published')),
  editorial_order integer check (editorial_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.hotels for each row execute function private.set_updated_at();

create table public.stays (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  trip_id uuid not null references public.trips(id) on delete restrict,
  check_in date,
  check_out date,
  check (check_in is null or check_out is null or check_out >= check_in),
  room_type text,
  purpose text check (purpose in ('business','leisure','family','mixed')),
  rating smallint check (rating between 1 and 5),
  review_text text,
  internal_notes text,
  status text not null default 'draft' check (status in ('draft','published')),
  editorial_order integer check (editorial_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.stays for each row execute function private.set_updated_at();

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source_name text,
  total_files integer not null default 0 check (total_files >= 0),
  eligible_files integer not null default 0 check (eligible_files >= 0),
  skipped_personal integer not null default 0 check (skipped_personal >= 0),
  imported integer not null default 0 check (imported >= 0),
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  check (eligible_files::bigint + skipped_personal::bigint <= total_files),
  check (imported <= eligible_files)
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  filename text not null check (length(btrim(filename)) > 0),
  storage_key text not null unique check (length(btrim(storage_key)) > 0),
  file_hash text not null check (file_hash ~ '^[a-f0-9]{64}$'),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  file_size bigint not null check (file_size > 0),
  classification text not null check (classification in ('nice','record')),
  context text not null check (context in ('travel','hotel')),
  featured boolean not null default false,
  caption text,
  description text,
  status text not null default 'draft' check (status in ('draft','published')),
  editorial_order integer check (editorial_order >= 0),
  trip_id uuid  references public.trips(id) on delete restrict,
  location_id uuid  references public.locations(id) on delete restrict,
  stay_id uuid  references public.stays(id) on delete restrict,
  import_batch_id uuid  references public.import_batches(id) on delete restrict,
  processing_status text not null default 'pending' check (processing_status in ('pending','ready','failed')),
  captured_at timestamp without time zone,
  captured_at_offset_minutes smallint check (captured_at_offset_minutes between -840 and 840),
  latitude numeric check (latitude between -90 and 90),
  longitude numeric check (longitude between -180 and 180),
  check ((latitude is null) = (longitude is null)),
  camera_make text,
  camera_model text,
  lens text,
  focal_length numeric check (focal_length > 0),
  aperture numeric check (aperture > 0),
  shutter_speed text,
  iso integer check (iso > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photo_context_shape check ((context = 'travel' and stay_id is null) or (context = 'hotel' and trip_id is null and location_id is null)),
  constraint photo_publish_assignment check (status <> 'published' or (context = 'travel' and trip_id is not null and location_id is not null) or (context = 'hotel' and stay_id is not null)),
  constraint photo_featured_eligibility check (not featured or (status = 'published' and classification = 'nice')),
  constraint photo_publish_ready check (status <> 'published' or processing_status = 'ready'),
  constraint photo_trip_location_membership foreign key (trip_id,location_id) references public.trip_locations(trip_id,location_id) on delete restrict
);

create trigger set_updated_at before update on public.photos for each row execute function private.set_updated_at();

alter table public.trips add constraint trips_cover_photo_fk foreign key(cover_photo_id) references public.photos(id) on delete restrict;

alter table public.locations add constraint locations_cover_photo_fk foreign key(cover_photo_id) references public.photos(id) on delete restrict;

create index cities_country_id_idx on public.cities(country_id);

create index locations_city_id_idx on public.locations(city_id);

create index locations_cover_photo_id_idx on public.locations(cover_photo_id);

create index trips_cover_photo_id_idx on public.trips(cover_photo_id);

create index trip_cities_city_id_idx on public.trip_cities(city_id);

create index trip_locations_location_id_idx on public.trip_locations(location_id);

create index hotels_city_id_idx on public.hotels(city_id);

create index stays_hotel_id_status_idx on public.stays(hotel_id,status);

create index stays_trip_id_status_idx on public.stays(trip_id,status);

create index photos_trip_id_status_classification_idx on public.photos(trip_id,status,classification);

create index photos_location_id_status_classification_idx on public.photos(location_id,status,classification);

create index photos_stay_id_status_classification_idx on public.photos(stay_id,status,classification);

create index photos_import_batch_id_idx on public.photos(import_batch_id);

create index photos_file_hash_idx on public.photos(file_hash);

alter table public.countries enable row level security;
revoke all on public.countries from public,anon,authenticated;
grant select,insert,update,delete on public.countries to authenticated;

grant select (id,name,code,slug,created_at) on public.countries to anon;

create policy admin_select on public.countries for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.countries for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.countries for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.countries for delete to authenticated using ((select public.is_admin()));

alter table public.cities enable row level security;
revoke all on public.cities from public,anon,authenticated;
grant select,insert,update,delete on public.cities to authenticated;

grant select (id,country_id,name,slug,latitude,longitude,created_at) on public.cities to anon;

create policy admin_select on public.cities for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.cities for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.cities for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.cities for delete to authenticated using ((select public.is_admin()));

alter table public.locations enable row level security;
revoke all on public.locations from public,anon,authenticated;
grant select,insert,update,delete on public.locations to authenticated;

grant select (id,city_id,name,slug,latitude,longitude,description,cover_photo_id,status,editorial_order,created_at,updated_at) on public.locations to anon;

create policy admin_select on public.locations for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.locations for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.locations for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.locations for delete to authenticated using ((select public.is_admin()));

alter table public.trips enable row level security;
revoke all on public.trips from public,anon,authenticated;
grant select,insert,update,delete on public.trips to authenticated;

grant select (id,title,slug,start_date,end_date,purpose,description,cover_photo_id,status,editorial_order,created_at,updated_at) on public.trips to anon;

create policy admin_select on public.trips for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.trips for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.trips for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.trips for delete to authenticated using ((select public.is_admin()));

alter table public.trip_cities enable row level security;
revoke all on public.trip_cities from public,anon,authenticated;
grant select,insert,update,delete on public.trip_cities to authenticated;

grant select (trip_id,city_id,sequence) on public.trip_cities to anon;

create policy admin_select on public.trip_cities for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.trip_cities for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.trip_cities for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.trip_cities for delete to authenticated using ((select public.is_admin()));

alter table public.trip_locations enable row level security;
revoke all on public.trip_locations from public,anon,authenticated;
grant select,insert,update,delete on public.trip_locations to authenticated;

grant select (trip_id,location_id,sequence,visited_at) on public.trip_locations to anon;

create policy admin_select on public.trip_locations for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.trip_locations for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.trip_locations for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.trip_locations for delete to authenticated using ((select public.is_admin()));

alter table public.hotels enable row level security;
revoke all on public.hotels from public,anon,authenticated;
grant select,insert,update,delete on public.hotels to authenticated;

grant select (id,name,slug,brand,city_id,address,latitude,longitude,description,rating,recommended_family,recommended_business,recommended_leisure,status,editorial_order,created_at,updated_at) on public.hotels to anon;

create policy admin_select on public.hotels for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.hotels for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.hotels for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.hotels for delete to authenticated using ((select public.is_admin()));

alter table public.stays enable row level security;
revoke all on public.stays from public,anon,authenticated;
grant select,insert,update,delete on public.stays to authenticated;

grant select (id,hotel_id,trip_id,check_in,check_out,room_type,purpose,rating,review_text,status,editorial_order,created_at,updated_at) on public.stays to anon;

create policy admin_select on public.stays for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.stays for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.stays for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.stays for delete to authenticated using ((select public.is_admin()));

alter table public.photos enable row level security;
revoke all on public.photos from public,anon,authenticated;
grant select,insert,update,delete on public.photos to authenticated;

grant select (id,width,height,classification,context,featured,caption,description,status,editorial_order,trip_id,location_id,stay_id,captured_at,camera_make,camera_model,lens,focal_length,aperture,shutter_speed,iso,created_at,updated_at) on public.photos to anon;

create policy admin_select on public.photos for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.photos for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.photos for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.photos for delete to authenticated using ((select public.is_admin()));

alter table public.import_batches enable row level security;
revoke all on public.import_batches from public,anon,authenticated;
grant select,insert,update,delete on public.import_batches to authenticated;

create policy admin_select on public.import_batches for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.import_batches for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.import_batches for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.import_batches for delete to authenticated using ((select public.is_admin()));

create policy public_read on public.trips for select to anon using (status = 'published');

create policy public_read on public.locations for select to anon using (status = 'published');

create policy public_read on public.hotels for select to anon using (status = 'published');

create policy public_read on public.stays for select to anon using (status = 'published' and exists(select 1 from public.trips t where t.id = stays.trip_id) and exists(select 1 from public.hotels h where h.id = stays.hotel_id));

create policy public_read on public.photos for select to anon using (status = 'published' and processing_status = 'ready' and ((context = 'travel' and exists(select 1 from public.trips t where t.id = photos.trip_id) and exists(select 1 from public.locations l where l.id = photos.location_id)) or (context = 'hotel' and exists(select 1 from public.stays s where s.id = photos.stay_id))));

create policy public_read on public.trip_locations for select to anon using (exists(select 1 from public.trips t where t.id = trip_locations.trip_id) and exists(select 1 from public.locations l where l.id = trip_locations.location_id));

create policy public_read on public.trip_cities for select to anon using (exists(select 1 from public.trips t where t.id = trip_cities.trip_id));

create policy public_read on public.cities for select to anon using (exists(select 1 from public.locations l where l.city_id = cities.id) or exists(select 1 from public.hotels h where h.city_id = cities.id) or exists(select 1 from public.trip_cities tc where tc.city_id = cities.id));

create policy public_read on public.countries for select to anon using (exists(select 1 from public.cities c where c.country_id = countries.id));

grant usage on schema public to anon, authenticated;
commit;
