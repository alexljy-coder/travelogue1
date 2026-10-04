import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTestDatabase, asRole } from './database';
import { createAnonymousClient } from './public-client';
import { archivePhotos, queryPhoto, selectHomepagePhotos } from '../src/lib/data/public-photos';
import { hotelPresentation, queryHotel, recommendations } from '../src/lib/data/public-hotels';
import { contextualPhotos } from '../src/lib/data/public-places';
import { singaporePhotos } from '../src/lib/data/public-singapore';
import { HotelPhotos } from '../src/components/admin/hotel-photos';
import { PhotoContextLinks } from '../src/components/public/journey';
import { hotelSchema } from '../src/lib/validation/content';
const hotel='50000000-0000-4000-8000-000000000001',photo='70000000-0000-4000-8000-000000000003',admin='00000000-0000-4000-8000-000000000001';
async function fixture(){const db=await createTestDatabase();await db.exec(await readFile('supabase/tests/fixtures.sql','utf8'));return db;}

test('M7.3 forward migration removes all visit objects and preserves Hotel/Photo/active-import data exactly',async()=>{
 const db=await createTestDatabase('20261003000100_hotel_archive_refinement.sql');try{
 await db.exec(await readFile('tests/fixtures/m73-legacy.sql','utf8'));
 await db.query('update public.hotels set cover_photo_id=$1,rating=4,recommended_family=true where id=$2',[photo,hotel]);
 const batch=randomUUID(),item=randomUUID();
 await asRole(db,'authenticated',admin,async()=>{
 await db.query('select public.admin_create_import_batch($1,null,1,1,0)',[batch]);
 await db.query('select public.admin_reserve_context_photo_import($1,$2,$3,$4,$5,$6,$7,$8)',[item,batch,'pending.jpg','8'.repeat(64),100,'nice','hotel',hotel]);
 });
 const hotels=(await db.query('select * from public.hotels order by id')).rows,photos=(await db.query('select * from public.photos order by id')).rows,imports=(await db.query('select * from public.import_items order by id')).rows;
 await db.exec(await readFile('supabase/migrations/20261004000100_remove_stays.sql','utf8'));
 assert.deepEqual((await db.query('select * from public.hotels order by id')).rows,hotels);
 assert.deepEqual((await db.query('select * from public.photos order by id')).rows,photos);
 assert.deepEqual((await db.query('select * from public.import_items order by id')).rows,imports);
 assert.equal((await db.query<{gone:null}>("select to_regclass('public.stays') gone")).rows[0].gone,null);
 assert.equal((await db.query("select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_save_stay'")).rows.length,0);
 assert.equal((await db.query("select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc ~ 'public[.]stays'")).rows.length,0);
 assert.ok(await queryPhoto(createAnonymousClient(db),photo));
 }finally{await db.close();}
});

test('Hotel documentation is absent from normal Photos/home/Singapore/Trip/Location galleries',async()=>{
 const db=await fixture();try{
 const client=createAnonymousClient(db);await db.query("update public.photos set featured=true where id=$1",[photo]);
 await db.exec("update public.countries set code='SG' where code='VC'");
 for(const classification of ['nice','record'] as const){
  const archive=await archivePhotos(client).eq('classification',classification);assert.equal(archive.error,null);assert.ok(archive.data?.every(p=>p.context==='travel'));
  assert.ok((await singaporePhotos(client,classification)).photos.every(p=>p.context==='travel'));
  assert.ok((await contextualPhotos(client,'trip_id','30000000-0000-4000-8000-000000000001',classification)).photos.every(p=>p.context==='travel'));
  assert.ok((await contextualPhotos(client,'location_id','40000000-0000-4000-8000-000000000001',classification)).photos.every(p=>p.context==='travel'));
 }
 const hotelPhoto=(await queryPhoto(client,photo))!;assert.deepEqual(selectHomepagePhotos([hotelPhoto],[hotelPhoto]),[]);
 const requests:string[]=[];const h=(await queryHotel(client,'published-hotel'))!;
 const presentation=await hotelPresentation(createAnonymousClient(db,requests),h,{photos:1});assert.equal(presentation.cover?.id,photo);
 assert.ok(requests.every(r=>!r.includes('stays')));assert.ok(requests.length<=11,`${requests.length} reads`);
 const links=renderToStaticMarkup(createElement(PhotoContextLinks,{photo:hotelPhoto}));assert.match(links,/href="\/hotels\/published-hotel"/);assert.doesNotMatch(links,/\/stays|\/trips/);
 }finally{await db.close();}
});

test('Hotel rating/review/recommendations/geography save without any Trip relationship',async()=>{
 const db=await fixture();try{
 const record=(await db.query<Record<string,unknown>>('select * from public.hotels where id=$1',[hotel])).rows[0];
 await asRole(db,'authenticated',admin,()=>db.query('select public.admin_save_hotel($1,$2)',[hotel,{...record,city_id:'20000000-0000-4000-8000-000000000002',rating:5,review_text:'My current opinion',recommended_family:true,recommended_leisure:true}]));
 const client=createAnonymousClient(db),h=(await queryHotel(client,'published-hotel'))!;assert.equal(h.rating,5);assert.equal(h.review_text,'My current opinion');assert.deepEqual(recommendations(h),['Family','Personal / Leisure']);
 assert.equal((await db.query("select 1 from public.trip_cities where city_id='20000000-0000-4000-8000-000000000002' and trip_id='30000000-0000-4000-8000-000000000001'")).rows.length,0);
 for(const rating of ['0','6','4.5'])assert.equal(hotelSchema.safeParse({name:'Hotel',slug:'hotel',city_id:record.city_id,brand:'',address:'',latitude:'',longitude:'',description:'',review_text:'',cover_photo_id:'',recommended_family:'',recommended_business:'',recommended_leisure:'',editorial_order:'',status:'draft',rating}).success,false);
 }finally{await db.close();}
});

test('Hotel Photos section has a clear preselected Add Photos path, private preview and cover identity',()=>{
 const html=renderToStaticMarkup(createElement(HotelPhotos,{hotelId:hotel,count:1,coverId:photo,photos:[{id:photo,filename:'hotel.jpg',caption:null,width:800,height:400,processing_status:'ready',status:'published',classification:'nice',featured:false}]}));
 assert.match(html,/>Photos<\/h2>/);assert.match(html,/href="\/admin\/photos\/import\?hotel=50000000/);assert.match(html,/>Add Photos<\/a>/);assert.match(html,/Selected cover/);assert.match(html,/\/admin\/photos\/.*\/image\/thumbnail/);assert.doesNotMatch(html,/Stay|source\.jpg/);
 const empty=renderToStaticMarkup(createElement(HotelPhotos,{hotelId:hotel,count:0,coverId:null,photos:[]}));assert.match(empty,/Add Photos to begin/);
});
