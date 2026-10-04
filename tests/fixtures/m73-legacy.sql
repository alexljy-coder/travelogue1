-- Synthetic fixtures, test-only. No real travel data or photographs.
insert into auth.users(id) values
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000002');
insert into private.admin_identity(user_id) values ('00000000-0000-4000-8000-000000000001');
insert into public.countries(id,name,code,slug) values
 ('10000000-0000-4000-8000-000000000001','Visible Country','VC','visible-country'),
 ('10000000-0000-4000-8000-000000000002','Private Country','PC','private-country');
insert into public.cities(id,country_id,name,slug) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Visible City','city'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Private City','city');
insert into public.trips(id,title,slug,status) values
 ('30000000-0000-4000-8000-000000000001','Published Trip','published-trip','published'),
 ('30000000-0000-4000-8000-000000000002','Draft Trip','draft-trip','draft');
insert into public.locations(id,city_id,name,slug,status) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Published Location','published-location','published'),
 ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Draft Location','draft-location','draft');
insert into public.trip_cities(trip_id,city_id) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002');
insert into public.trip_locations(trip_id,location_id) values
 ('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002');
insert into public.hotels(id,city_id,name,slug,status) values
 ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Published Hotel','published-hotel','published'),
 ('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Draft Hotel','draft-hotel','draft');
insert into public.stays(id,hotel_id,trip_id,status,internal_notes) values
 ('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','published','PRIVATE NOTE'),
 ('60000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','published','PRIVATE NOTE'),
 ('60000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','published',null),
 ('60000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','draft',null);
insert into public.import_batches(id,total_files,eligible_files,skipped_personal,imported,status) values
 ('80000000-0000-4000-8000-000000000001',3,2,1,2,'completed');
insert into public.photos(id,filename,storage_key,file_hash,width,height,file_size,classification,context,status,processing_status,trip_id,location_id,hotel_id,latitude,longitude) values
 ('70000000-0000-4000-8000-000000000001','nice.jpg','test/1',repeat('a',64),4000,3000,1000,'nice','travel','published','ready','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',null,1.2,103.4),
 ('70000000-0000-4000-8000-000000000002','record.jpg','test/2',repeat('b',64),4000,3000,1000,'record','travel','published','ready','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',null,null,null),
 ('70000000-0000-4000-8000-000000000003','hotel.jpg','test/3',repeat('c',64),4000,3000,1000,'nice','hotel','published','ready',null,null,'50000000-0000-4000-8000-000000000001',null,null),
 ('70000000-0000-4000-8000-000000000004','draft-trip.jpg','test/4',repeat('d',64),4000,3000,1000,'nice','travel','published','ready','30000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001',null,null,null),
 ('70000000-0000-4000-8000-000000000005','draft-location.jpg','test/5',repeat('e',64),4000,3000,1000,'nice','travel','published','ready','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',null,null,null),
 ('70000000-0000-4000-8000-000000000006','draft-hotel.jpg','test/6',repeat('f',64),4000,3000,1000,'nice','hotel','published','ready',null,null,'50000000-0000-4000-8000-000000000002',null,null),
 ('70000000-0000-4000-8000-000000000007','draft-stay.jpg','test/7',repeat('a',64),4000,3000,1000,'nice','hotel','draft','ready',null,null,'50000000-0000-4000-8000-000000000001',null,null),
 ('70000000-0000-4000-8000-000000000008','draft.jpg','test/8',repeat('a',64),4000,3000,1000,'nice','travel','draft','pending',null,null,null,null,null),
 ('70000000-0000-4000-8000-000000000009','draft-stay-trip.jpg','test/9',repeat('a',64),4000,3000,1000,'nice','hotel','draft','ready',null,null,'50000000-0000-4000-8000-000000000001',null,null);

update public.hotels set review_text='Public review' where slug='published-hotel';
