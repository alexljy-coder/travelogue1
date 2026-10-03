// Disposable SQL fixture audit: counts actual supabase-js requests, never production writes.
import { readFile } from 'node:fs/promises';
import { createTestDatabase } from '../tests/database';
import { createAnonymousClient } from '../tests/public-client';
import { queryHotelIndex, queryHotel, hotelPresentation } from '../src/lib/data/public-stays';
import { queryTripIndex, queryTrip, queryLocation, publicCover, contextualPhotos, tripGeography, tripPlaces, locationGeography, locationTrips } from '../src/lib/data/public-places';
import { orderedPhotos, attachContexts, queryPhoto, selectHomepagePhotos } from '../src/lib/data/public-photos';
import { singaporeOpening, singaporePhotos, singaporePlaces } from '../src/lib/data/public-singapore';
const db = await createTestDatabase();
try {
 await db.exec(await readFile('supabase/tests/fixtures.sql','utf8'));
 for (let i=10;i<22;i++) {
  const suffix=String(i).padStart(12,'0');
  await db.exec(`insert into public.trips(id,title,slug,status)values('30000000-0000-4000-8000-${suffix}','Trip ${i}','trip-${i}','published');
  insert into public.trip_cities(trip_id,city_id)values('30000000-0000-4000-8000-${suffix}','20000000-0000-4000-8000-000000000001');
  insert into public.trip_locations(trip_id,location_id)values('30000000-0000-4000-8000-${suffix}','40000000-0000-4000-8000-000000000001');
  insert into public.hotels(id,name,slug,city_id,status)values('50000000-0000-4000-8000-${suffix}','Hotel ${i}','hotel-${i}','20000000-0000-4000-8000-000000000001','published');`);
 }
 const requests:string[]=[]; const c=createAnonymousClient(db,requests);
 const routes:Record<string,()=>Promise<unknown>>={
  '/':async()=>{const [f,r]=await Promise.all([orderedPhotos(c).eq('classification','nice').eq('featured',true).limit(1),orderedPhotos(c).eq('classification','nice').limit(9)]);return attachContexts(c,selectHomepagePhotos(f.data??[],r.data??[],10));},
  '/photos':async()=>attachContexts(c,(await orderedPhotos(c).eq('classification','nice').limit(25)).data??[]),
  '/singapore':async()=>Promise.all([singaporeOpening(c),singaporePhotos(c,'nice'),singaporePhotos(c,'record'),singaporePlaces(c)]),
  '/trips':()=>queryTripIndex(c),
  '/trips/[slug]':async()=>{const t=(await queryTrip(c,'published-trip'))!;const cover=await publicCover(c,'trip_id',t);return Promise.all([tripGeography(c,t.id),tripPlaces(c,t.id),contextualPhotos(c,'trip_id',t.id,'nice',1,cover?.id),contextualPhotos(c,'trip_id',t.id,'record')]);},
  '/locations/[slug]':async()=>{const l=(await queryLocation(c,'published-location'))!;const cover=await publicCover(c,'location_id',l);return Promise.all([locationGeography(c,l),locationTrips(c,l.id),contextualPhotos(c,'location_id',l.id,'nice',1,cover?.id)]);},
  '/stays':()=>queryHotelIndex(c),
  '/stays/[hotelSlug]':async()=>hotelPresentation(c,(await queryHotel(c,'published-hotel'))!,{stays:1,photos:1}),
  '/photos/[id]':()=>queryPhoto(c,'70000000-0000-4000-8000-000000000003'),
 };
 for(const [path,run] of Object.entries(routes)){requests.length=0;const start=performance.now();await run();console.log(JSON.stringify({path,requests:requests.length,localMs:Math.round(performance.now()-start),tables:requests.map(r=>r.split(':')[0])}));}
}finally{await db.close();}
