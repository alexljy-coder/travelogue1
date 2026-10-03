import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTestDatabase,asRole} from './database';
import {createAnonymousClient} from './public-client';
import {queryHotel,queryHotelIndex,hotelCover,hotelPhotos} from '../src/lib/data/public-stays';
import {queryTripIndex} from '../src/lib/data/public-places';
import {queryPhoto,orderedPhotos} from '../src/lib/data/public-photos';
import {Photograph,PhotoGrid,responsiveSources} from '../src/components/public/photograph';
import {HotelEditorial,HotelReview} from '../src/components/public/stay';
import {deliverPublicImage} from '../src/lib/photos/public-image';
const hotel='50000000-0000-4000-8000-000000000001',photo='70000000-0000-4000-8000-000000000003',admin='00000000-0000-4000-8000-000000000001';
async function fixture(){const db=await createTestDatabase();await db.exec(await readFile('supabase/tests/fixtures.sql','utf8'));return db;}

test('M7.1 forward migration preserves identities, private GPS, keys and active imports without exposing hidden photos',async()=>{
 const db=await createTestDatabase('20261002000100_found_along_home.sql');try{
 await db.exec(await readFile('tests/fixtures/m71-legacy.sql','utf8'));
 const before=(await db.query('select id,storage_key,file_hash,latitude,longitude from public.photos order by id')).rows;
 const batch=randomUUID(),item=randomUUID();
 await asRole(db,'authenticated',admin,async()=>{
  await db.query('select public.admin_create_import_batch($1,null,1,1,0)',[batch]);
  await db.query('select public.admin_reserve_context_photo_import($1,$2,$3,$4,$5,$6,$7,$8)',[item,batch,'pending.jpg','9'.repeat(64),100,'nice','hotel','60000000-0000-4000-8000-000000000001']);
 });
 await db.exec(await readFile('supabase/migrations/20261003000100_hotel_archive_refinement.sql','utf8'));
 assert.deepEqual((await db.query('select id,storage_key,file_hash,latitude,longitude from public.photos order by id')).rows,before);
 assert.equal((await db.query<{hotel_id:string}>('select hotel_id from public.import_items where id=$1',[item])).rows[0].hotel_id,hotel);
 assert.equal((await db.query('select id from public.stays')).rows.length,4);
 for(const id of ['70000000-0000-4000-8000-000000000006','70000000-0000-4000-8000-000000000007','70000000-0000-4000-8000-000000000009']){
  assert.equal((await db.query<{status:string}>('select status from public.photos where id=$1',[id])).rows[0].status,'draft');
  assert.equal(await queryPhoto(createAnonymousClient(db),id),null);
 }
 assert.ok(await queryPhoto(createAnonymousClient(db),photo));
 assert.equal((await db.query<{review_text:null}>('select review_text from public.hotels where id=$1',[hotel])).rows[0].review_text,null);
 assert.equal((await db.query("select column_name from information_schema.columns where table_name='stays' and column_name in ('rating','review_text','purpose','room_type')")).rows.length,0);
 }finally{await db.close();}
});

test('Hotel current opinion persists independently of lightweight visits and renders public review safely',async()=>{
 const db=await fixture();try{
 await db.query("update public.hotels set rating=4,review_text='<script>literal review</script>',recommended_business=true where id=$1",[hotel]);
 let first='',second='';
 await db.exec("update public.countries set code='SG' where code='VC'");
 await asRole(db,'authenticated',admin,async()=>{
  const visits:string[]=[];
  for(let i=0;i<2;i++) visits.push((await db.query<{id:string}>('select public.admin_save_stay(null,$1) id',[{hotel_id:hotel,check_in:null,check_out:null,trip_id:null,status:'published',internal_notes:'PRIVATE VISIT NOTE'}])).rows[0].id);
  [first,second]=visits;
  await db.query('delete from public.stays where id=$1',[first]);
 });
 const client=createAnonymousClient(db),h=await queryHotel(client,'published-hotel');assert.ok(h);
 assert.equal(h.rating,4);assert.equal(h.review_text,'<script>literal review</script>');assert.equal(h.recommended_business,true);
 const html=renderToStaticMarkup(React.createElement(HotelEditorial,{hotel:h}));assert.match(html,/4 \/ 5 stars/);assert.match(html,/Business/);
 const review=renderToStaticMarkup(React.createElement(HotelReview,{text:h.review_text}));assert.match(review,/&lt;script&gt;/);assert.doesNotMatch(review,/<script>/);
 assert.ok(await queryPhoto(client,photo));
 assert.equal((await db.query('select id from public.stays where id=$1',[second])).rows.length,1);
 }finally{await db.close();}
});

test('Hotel cover selection requires matching ready Published Nice photography; stale pointers safely fall back',async()=>{
 const db=await fixture();try{
 const input=(await db.query<Record<string,unknown>>('select * from public.hotels where id=$1',[hotel])).rows[0];
 await asRole(db,'authenticated',admin,async()=>{
  await db.query('select public.admin_save_hotel($1,$2)',[hotel,{...input,cover_photo_id:photo}]);
  await assert.rejects(db.query('select public.admin_save_hotel($1,$2)',[hotel,{...input,cover_photo_id:'70000000-0000-4000-8000-000000000001'}]),/Published Nice Hotel photo/);
  await assert.rejects(db.query('select public.admin_begin_photo_delete($1,$2)',[photo,randomUUID()]),/Remove this photo from covers/);
 });
 const client=createAnonymousClient(db);assert.equal((await hotelCover(client,hotel))?.id,photo);
 await db.query("update public.photos set classification='record' where id=$1",[photo]);assert.equal(await hotelCover(client,hotel),null);
 assert.equal((await queryHotelIndex(client)).hotels[0].cover,null);
 }finally{await db.close();}
});

test('Hotel ownership withdrawal governs public images without depending on visits; source and exact GPS stay private',async()=>{
 const db=await fixture();try{
 await db.query('update public.photos set latitude=1.23456789,longitude=103.98765432 where id=$1',[photo]);
 await db.query("update public.stays set status='draft'");
 const client=createAnonymousClient(db);const payload=await hotelPhotos(client,hotel);
 assert.equal(payload.photos.length,1);assert.doesNotMatch(JSON.stringify(payload),/1\.23456789|103\.98765432|latitude|longitude|internal_notes|storage_key/);
 let reads=0;const deps={visible:async(id:string)=>!!await queryPhoto(client,id),media:async()=>{reads++;return {body:new ReadableStream({start(c){c.close();}}),contentType:'image/webp'};},missing:()=>false};
 assert.equal((await deliverPublicImage(photo,'large',deps)).status,200);
 assert.equal((await deliverPublicImage(photo,'source',deps)).status,404);
 await db.query("update public.hotels set status='draft' where id=$1",[hotel]);
 assert.equal((await deliverPublicImage(photo,'large',deps)).status,404);assert.equal(reads,1);
 await asRole(db,'anon',null,async()=>{
  for(const column of ['latitude','longitude','storage_key','filename'])await assert.rejects(db.query(`select ${column} from public.photos`));
  await assert.rejects(db.query('select internal_notes from public.stays'));
 });
 }finally{await db.close();}
});

test('bounded public cover RPC has invoker security, respects RLS, and avoids index N+1 HTTP queries',async()=>{
 const db=await fixture();try{
 for(let i=0;i<11;i++){
  const h=randomUUID();await db.query("insert into public.hotels(id,name,slug,city_id,status)values($1,$2,$3,'20000000-0000-4000-8000-000000000001','published')",[h,`Property ${i}`,`property-${i}`]);
  const p=randomUUID();await db.query("insert into public.photos(id,filename,storage_key,file_hash,width,height,file_size,classification,context,status,processing_status,hotel_id) values($1::uuid,'x.jpg',$1::text,repeat('a',64),800,400,100,'nice','hotel','published','ready',$2)",[p,h]);
 }
 const requests:string[]=[];const client=createAnonymousClient(db,requests);const hotels=await queryHotelIndex(client);
 assert.equal(hotels.hotels.length,12);assert.ok(hotels.hotels.every(h=>!!h.cover));
 assert.ok(requests.length<=8,`${requests.length} requests`);assert.equal(requests.filter(r=>r.startsWith('rpc:')).length,1);
 requests.length=0;const trips=await queryTripIndex(client);assert.equal(trips.trips.length,1);assert.ok(requests.length<=10);
 await asRole(db,'anon',null,()=>assert.rejects(db.query('select * from public.public_archive_covers($1,\'hotel\')',[Array(13).fill(hotel)])));
 await asRole(db,'authenticated','00000000-0000-4000-8000-000000000002',async()=>assert.equal((await db.query("select * from public.public_archive_covers($1,'hotel')",[[hotel]])).rows.length,0));
 }finally{await db.close();}
});

test('responsive detail sizing accounts for viewport height and contextual grids remain lazy with legacy support',async()=>{
 const db=await fixture();try{
 const p=(await queryPhoto(createAnonymousClient(db),photo))!;
 const portrait={...p,width:4000,height:6000,derivative_profile:2};
 const html=renderToStaticMarkup(React.createElement(Photograph,{photo:portrait,detail:true}));
 assert.match(html,/56\.67vh/);assert.match(html,/loading="lazy"/);assert.doesNotMatch(html,/source/);
 assert.match(responsiveSources({...portrait,derivative_profile:1}),/large 1600w/);
 assert.match(responsiveSources(portrait),/large 2133w/);
 const grid=renderToStaticMarkup(React.createElement(PhotoGrid,{photos:[p,p]}));assert.equal((grid.match(/loading="lazy"/g)??[]).length,2);
 assert.ok((await orderedPhotos(createAnonymousClient(db))).data?.some(x=>x.id===photo));
 }finally{await db.close();}
});
