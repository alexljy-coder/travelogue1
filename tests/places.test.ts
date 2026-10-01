import assert from 'node:assert/strict';
import {before,after,beforeEach,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import type {PGlite} from '@electric-sql/pglite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTestDatabase} from './database';
import {createAnonymousClient} from './public-client';
import {contextualPhotos,locationTrips,publicCover,queryLocation,queryTrip,queryTripIndex,tripPlaces,tripDates} from '../src/lib/data/public-places';
import {queryPhoto} from '../src/lib/data/public-photos';
import {PhotoContextLinks,TripIdentity} from '../src/components/public/journey';
let db:PGlite;
const trip='30000000-0000-4000-8000-000000000001';const location='40000000-0000-4000-8000-000000000001';
const photo=(n:number)=>`70000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
before(async()=>{db=await createTestDatabase();});after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('truncate public.import_items,public.import_batches,public.photos,public.trip_locations,public.trip_cities,public.stays,public.hotels,public.locations,public.trips,public.cities,public.countries,private.admin_identity,auth.users');await db.exec(await readFile('supabase/tests/fixtures.sql','utf8'));});
test('Trip index/details expose Published slugs and real supporting geography; Draft/missing invalid slugs hidden',async()=>{
 const client=createAnonymousClient(db);const result=await queryTripIndex(client);assert.equal(result.trips.length,1);assert.equal(result.trips[0].slug,'published-trip');assert.equal(result.trips[0].cities.length,1);
 assert.ok(await queryTrip(client,'published-trip'));for(const slug of ['draft-trip','missing-trip','bad/slug'])assert.equal(await queryTrip(client,slug),null);
 assert.equal(await queryLocation(client,'draft-location'),null);assert.equal(await queryLocation(client,'missing-place'),null);
});
test('Trip and Location photography includes only public Travel context; Record remains separate and Hotel excluded',async()=>{
 const client=createAnonymousClient(db);const nice=await contextualPhotos(client,'trip_id',trip,'nice');const record=await contextualPhotos(client,'trip_id',trip,'record');
 assert.deepEqual(nice.photos.map(p=>p.id),[photo(1)]);assert.deepEqual(record.photos.map(p=>p.id),[photo(2)]);
 assert.deepEqual((await contextualPhotos(client,'location_id',location,'nice')).photos.map(p=>p.id),[photo(1)]);
 await db.exec("update public.locations set status='draft' where id='"+location+"'");assert.deepEqual((await contextualPhotos(client,'trip_id',trip,'nice')).photos,[]);
});
test('cover resolves safe explicit Nice Travel photo and rejects Draft, Record, wrong context and hidden-parent pointers',async()=>{
 const client=createAnonymousClient(db);
 for(const candidate of [photo(2),photo(3),photo(4),photo(5),photo(8)])assert.equal((await publicCover(client,'trip_id',{id:trip,cover_photo_id:candidate}))?.id,photo(1));
 assert.equal((await publicCover(client,'trip_id',{id:trip,cover_photo_id:photo(1)}))?.id,photo(1));
 await db.exec("update public.photos set status='draft',featured=false where id='"+photo(1)+"'");assert.equal(await publicCover(client,'trip_id',{id:trip,cover_photo_id:photo(1)}),null);
});
test('cover rejects otherwise eligible Nice from a different Trip and prefers explicit cover over fallback',async()=>{
 const client=createAnonymousClient(db);
 await db.exec(`insert into public.trips(id,title,slug,status) values('30000000-0000-4000-8000-000000000003','Other','other','published');insert into public.trip_locations(trip_id,location_id) values('30000000-0000-4000-8000-000000000003','${location}');update public.photos set trip_id='30000000-0000-4000-8000-000000000003' where id='${photo(4)}';insert into public.photos(id,filename,storage_key,file_hash,width,height,file_size,classification,context,status,processing_status,trip_id,location_id) values('${photo(10)}','test.jpg','unique/',repeat('b',64),1000,800,1000,'nice','travel','published','ready','${trip}','${location}');`);
 assert.equal((await publicCover(client,'trip_id',{id:trip,cover_photo_id:photo(4)}))?.trip_id,trip);
 assert.equal((await publicCover(client,'trip_id',{id:trip,cover_photo_id:photo(1)}))?.id,photo(1));
});
test('Location many-to-many Trips and Trip Places retain published relationships only; geographic payload omits coordinates/private fields',async()=>{
 const requests:string[]=[];const client=createAnonymousClient(db,requests);
 const places=await tripPlaces(client,trip);assert.equal(places.places.length,1);assert.equal(places.places[0].slug,'published-location');
 const trips=await locationTrips(client,location);assert.deepEqual(trips.trips.map(t=>t.slug),['published-trip']);
 assert.ok(requests.every(q=>!(/latitude|longitude|internal_notes|storage_key|file_hash|\*/.test(q))));
 await db.exec(`update public.trips set status='draft' where id='${trip}'`);assert.equal(await queryTrip(client,'published-trip'),null);assert.deepEqual((await locationTrips(client,location)).trips,[]);assert.deepEqual((await contextualPhotos(client,'location_id',location,'nice')).photos,[]);
 assert.ok(await queryLocation(client,'published-location'),'independently Published Location remains valid');
});
test('undated/partial-dated Trips render without invented dates or IDs; sparse/empty archives valid',async()=>{
 const client=createAnonymousClient(db);const visible=await queryTrip(client,'published-trip');assert.ok(visible);assert.equal(tripDates(visible),null);
 const html=renderToStaticMarkup(createElement(TripIdentity,{trip:visible}));assert.match(html,/Published Trip/);assert.doesNotMatch(html,/journey-dates|30000000|Unknown|1970/);
 assert.match(tripDates({...visible,start_date:'2024-03-01'})!,/^From /);assert.match(tripDates({...visible,end_date:'2024-03-02'})!,/^Until /);
 await db.exec("update public.photos set status='draft',featured=false");assert.equal((await queryTripIndex(client)).trips[0].cover,null);
 await db.exec("update public.trips set status='draft'");assert.deepEqual((await queryTripIndex(client)).trips,[]);
});
test('Photo links target only actual public Trip and Location slugs, retaining UUID Photo identity',async()=>{
 const client=createAnonymousClient(db);const p=await queryPhoto(client,photo(1));assert.ok(p);
 const html=renderToStaticMarkup(createElement(PhotoContextLinks,{photo:p}));assert.match(html,/href="\/trips\/published-trip"/);assert.match(html,/href="\/locations\/published-location"/);assert.doesNotMatch(html,/\/stays|\/cities|\/countries/);
});
test('contextual photo pages bounded to 24 plus lookahead, hero excluded without losing subsequent pages',async()=>{
 await db.exec(`insert into public.photos(filename,storage_key,file_hash,width,height,file_size,classification,context,status,processing_status,trip_id,location_id) select 'test.jpg','batch/'||n,repeat('c',64),1000,800,1000,'nice','travel','published','ready','${trip}','${location}' from generate_series(1,50) n`);
 const client=createAnonymousClient(db);const first=await contextualPhotos(client,'trip_id',trip,'nice',1,photo(1));const second=await contextualPhotos(client,'trip_id',trip,'nice',2,photo(1));const third=await contextualPhotos(client,'trip_id',trip,'nice',3,photo(1));
 assert.equal(first.photos.length,24);assert.equal(second.photos.length,24);assert.equal(third.photos.length,2);assert.equal(first.hasNext,true);assert.equal(third.hasNext,false);
 assert.equal(new Set([...first.photos,...second.photos,...third.photos].map(p=>p.id)).size,50);assert.ok(first.photos.every(p=>p.id!==photo(1)));
});
test('multiple public Trips share a Location without mixing Trip photographs; supporting Cities cross chunk limits',async()=>{
 const client=createAnonymousClient(db);
 await db.exec("update public.trips set status='published' where slug='draft-trip'");
 assert.equal((await locationTrips(client,location)).trips.length,2);
 assert.equal((await contextualPhotos(client,'location_id',location,'nice')).photos.length,2);
 assert.deepEqual((await contextualPhotos(client,'trip_id',trip,'nice')).photos.map(p=>p.id),[photo(1)]);
 await db.exec(`with added as (insert into public.cities(country_id,name,slug) select (select id from public.countries order by id limit 1),'City '||n,'city-'||n from generate_series(1,205) n returning id) insert into public.trip_cities(trip_id,city_id) select '${trip}',id from added`);
 const result=await queryTripIndex(client);
 assert.equal(result.trips.find(t=>t.id===trip)?.cities.length,206);
});
