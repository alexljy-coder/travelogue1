import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import { createTestDatabase, asRole } from './database';
import { createAnonymousClient } from './public-client';
import { singaporePhotos, singaporeOpening, singaporePlaces } from '../src/lib/data/public-singapore';
import { orderedPhotos, queryPhoto } from '../src/lib/data/public-photos';
import { photoPublicationErrors } from '../src/lib/validation/publishing';
import { processJpeg } from '../src/lib/photos/image';
import { MAX_SOURCE_BYTES, scanFiles } from '../src/lib/photos/model';
import { responsiveSources } from '../src/components/public/photograph';
import { deliverPublicImage } from '../src/lib/photos/public-image';
const admin='00000000-0000-4000-8000-000000000001';
const trip='30000000-0000-4000-8000-000000000001';
const location='40000000-0000-4000-8000-000000000001';
const hotel='50000000-0000-4000-8000-000000000001';
const photo='70000000-0000-4000-8000-000000000001';
async function fixture(home=true) {
  const db=await createTestDatabase();
  await db.exec(await readFile('supabase/tests/fixtures.sql','utf8'));
  if(home) await db.exec("update public.countries set code='SG' where id='10000000-0000-4000-8000-000000000001'");
  return db;
}
test('Singapore published photography can omit Trip, stays global and respects Location withdrawal',async()=>{
 const db=await fixture();try{
 await asRole(db,'authenticated',admin,()=>db.query('update public.photos set trip_id=null where id=$1',[photo]));
 const client=createAnonymousClient(db);assert.ok(await queryPhoto(client,photo));
 assert.ok((await orderedPhotos(client)).data?.some(p=>p.id===photo));
 const publicPhotos=(await singaporePhotos(client,'nice')).photos;assert.ok(publicPhotos.some(p=>p.id===photo));assert.ok(!publicPhotos.some(p=>['70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000004'].includes(p.id)));
 let reads=0;const visible=async(id:string)=>!!await queryPhoto(client,id);
 assert.equal((await deliverPublicImage(photo,'large',{visible,media:async()=>{reads++;return {body:new ReadableStream({start(c){c.close();}}),contentType:'image/webp'};},missing:()=>false})).status,200);
 await db.query("update public.locations set status='draft' where id=$1",[location]);
 assert.equal(await queryPhoto(client,photo),null);assert.deepEqual((await singaporePhotos(client,'nice')).photos,[]);
 assert.equal((await deliverPublicImage(photo,'large',{visible,media:async()=>{throw new Error('Must not fetch');},missing:()=>false})).status,404);
 assert.equal(reads,1);
 }finally{await db.close();}
});
test('overseas trip-less publication is rejected by actual database and preflight',async()=>{
 const db=await fixture(false);try{
 await assert.rejects(asRole(db,'authenticated',admin,()=>db.query('update public.photos set trip_id=null where id=$1',[photo])),/Trip is required/);
 const p={status:'published',classification:'nice',context:'travel',processing_status:'ready',featured:false,trip_id:null,location_id:location,hotel_id:null} as const;
 assert.deepEqual(photoPublicationErrors(p,{location:{id:location,status:'published',country_code:'SG'}}),[]);
 assert.ok(photoPublicationErrors(p,{location:{id:location,status:'published',country_code:'JP'}}).length);
 }finally{await db.close();}
});
test('Singapore photography may belong to a real Trip, whose withdrawal still hides it',async()=>{
 const db=await fixture();try{
 const client=createAnonymousClient(db);assert.ok((await singaporePhotos(client,'nice')).photos.some(p=>p.id===photo));
 await db.query("update public.trips set status='draft' where id=$1",[trip]);
 assert.equal(await queryPhoto(client,photo),null);assert.deepEqual((await singaporePhotos(client,'nice')).photos,[]);
 }finally{await db.close();}
});
test('Singapore Hotel photography remains separate and independent of Trips',async()=>{
 const db=await fixture();try{
 const client=createAnonymousClient(db);const photos=(await singaporePhotos(client,'nice')).photos;
 assert.ok(photos.every(p=>p.context==='travel'));
 const hotelPhoto=await queryPhoto(client,'70000000-0000-4000-8000-000000000003');assert.ok(hotelPhoto);assert.equal(hotelPhoto.place.trip_slug,null);
 await db.query("update public.hotels set status='draft' where id=$1",[hotel]);
 assert.equal(await queryPhoto(client,'70000000-0000-4000-8000-000000000003'),null);
 }finally{await db.close();}
});
test('geography edits cannot silently invalidate trip-less home records',async()=>{
 const db=await fixture();try{
 await db.query('update public.photos set trip_id=null where id=$1',[photo]);
 await assert.rejects(db.query("update public.countries set code='JP' where code='SG'"),/dependent home records/);
 assert.ok(await queryPhoto(createAnonymousClient(db),photo));
 }finally{await db.close();}
});
test('Singapore empty/Featured/Record/Places selection uses only eligible ordinary geography',async()=>{
 const db=await fixture(false);try{
 const client=createAnonymousClient(db);assert.deepEqual((await singaporePhotos(client,'nice')).photos,[]);assert.equal(await singaporeOpening(client),null);assert.deepEqual((await singaporePlaces(client)).places,[]);
 await db.exec("update public.countries set code='SG' where id='10000000-0000-4000-8000-000000000001'");
 assert.equal((await singaporeOpening(client))?.id,photo);assert.ok((await singaporePlaces(client)).places.some(p=>p.id===location));
 assert.ok((await singaporePhotos(client,'record')).photos.every(p=>p.classification==='record'));
 const requests:string[]=[];await singaporePhotos(createAnonymousClient(db,requests),'nice');assert.ok(requests.every(q=>!q.includes('latitude')&&!q.includes('internal_notes')&&!q.includes('storage_key')));
 }finally{await db.close();}
});
test('full-resolution 60MP JPEG is accepted, metadata-free derivatives fit target and source is unchanged',async()=>{
 const source=await sharp({create:{width:9520,height:6336,channels:3,background:'#cabaa7'}}).jpeg({quality:88}).toBuffer();
 const hash=createHash('sha256').update(source).digest('hex');const result=await processJpeg(source,hash,source.length);
 assert.equal(result.metadata.width,9520);assert.equal(result.metadata.derivative_profile,2);assert.equal(createHash('sha256').update(source).digest('hex'),hash);
 const edges=[];for(const d of result.derivatives){const m=await sharp(d.bytes).metadata();edges.push(Math.max(m.width!,m.height!));assert.equal(m.exif,undefined);}
 assert.deepEqual(edges,[3200,1920,960,480]);
});
test('byte protection, no-upscale behavior and both derivative generations retain correct widths',async()=>{
 assert.ok(scanFiles([{name:'large.jpg',size:MAX_SOURCE_BYTES+1}],'nice').errors.length);
 const oversized=Buffer.alloc(MAX_SOURCE_BYTES+1);await assert.rejects(processJpeg(oversized,createHash('sha256').update(oversized).digest('hex'),oversized.length),/Uploaded bytes/);
 const source=await sharp({create:{width:240,height:120,channels:3,background:'#aaa'}}).jpeg().toBuffer();
 const result=await processJpeg(source,createHash('sha256').update(source).digest('hex'),source.length);
 for(const d of result.derivatives){const m=await sharp(d.bytes).metadata();assert.equal(m.width,240);assert.equal(m.height,120);}
 assert.match(responsiveSources({id:randomUUID(),width:6000,height:4000,derivative_profile:1}),/large 2400w/);
 assert.match(responsiveSources({id:randomUUID(),width:6000,height:4000,derivative_profile:2}),/large 3200w/);
 assert.equal((await deliverPublicImage(randomUUID(),'source',{visible:async()=>{throw new Error('No source lookup');},media:async()=>{throw new Error('No source fetch');},missing:()=>false})).status,404);
});
