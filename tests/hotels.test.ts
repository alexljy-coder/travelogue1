import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createTestDatabase } from './database';
import { createAnonymousClient } from './public-client';
import { hotelSchema } from '../src/lib/validation/content';
import { photoEditSchema } from '../src/lib/validation/photo';
import { prepareSchema } from '../src/lib/photos/model';
import { queryHotel, queryHotelIndex, hotelCover, hotelPhotos } from '../src/lib/data/public-hotels';
import { contextualPhotos } from '../src/lib/data/public-places';
let db: PGlite;
const admin = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
const hotel = '50000000-0000-4000-8000-000000000001', trip = '30000000-0000-4000-8000-000000000001', city = '20000000-0000-4000-8000-000000000001';
const hotelPhoto = '70000000-0000-4000-8000-000000000003';
const owner = <T>(run: () => Promise<T>) => asRole(db, 'authenticated', admin, run);
const code = (expected: string) => (e: unknown) => !!e && typeof e === 'object' && 'code' in e && e.code === expected;
before(async () => { db = await createTestDatabase(); });
after(async () => { await db?.close(); });
beforeEach(async () => { await db.exec('truncate public.countries,public.cities,public.locations,public.trips,public.trip_cities,public.trip_locations,public.hotels,public.photos,public.import_items,public.import_batches,private.admin_identity,auth.users'); await db.exec(await readFile('supabase/tests/fixtures.sql', 'utf8')); });
const hotelInput = { name: 'New Hotel', slug: 'new-hotel', city_id: city, brand: '', address: '', description: '', review_text:'', cover_photo_id:'', latitude: '', longitude: '', rating: '', recommended_family: '', recommended_business: '', recommended_leisure: '', status: 'draft', editorial_order: '' };
async function saveHotel(id: string | null, input = hotelInput) { const data = hotelSchema.parse(input); return (await db.query<{
    id: string;
}>('select public.admin_save_hotel($1,$2::jsonb) id', [id, JSON.stringify(data)])).rows[0].id; }
test('Hotel CRUD reuses geography, rejects duplicate identity and deletes only unreferenced properties', async () => owner(async () => {
    const id = await saveHotel(null);
    await saveHotel(id, { ...hotelInput, name: 'Edited Hotel', rating: '5', recommended_family: 'yes' });
    const row = (await db.query<{
        name: string;
        rating: number;
        recommended_family: boolean;
    }>('select * from public.hotels where id=$1', [id])).rows[0];
    assert.equal(row.name, 'Edited Hotel');
    assert.equal(row.rating, 5);
    assert.equal(row.recommended_family, true);
    await assert.rejects(saveHotel(null, { ...hotelInput, name: ' edited hotel ', slug: 'other-hotel' }), /already exists/);
    await assert.rejects(db.query('delete from public.hotels where id=$1', [hotel]), (e: unknown) => code('23503')(e) || code('23001')(e));
    await db.query('delete from public.hotels where id=$1', [id]);
    assert.equal((await db.query('select id from public.hotels where id=$1', [id])).rows.length, 0);
    assert.equal((await db.query('select id from public.cities where id=$1', [city])).rows.length, 1);
}));
test('Hotel Photo validates Hotel without Location and keeps mutually exclusive context and Featured rules', () => {
    const base = { context: 'hotel', hotel_id: hotel, trip_id: '', location_id: '', classification: 'nice', status: 'published', featured: '', caption: '', description: '', editorial_order: '' };
    assert.equal(photoEditSchema.safeParse(base).success, true);
    assert.equal(photoEditSchema.safeParse({ ...base, hotel_id: '' }).success, false);
    assert.equal(photoEditSchema.safeParse({ ...base, trip_id: trip }).success, false);
    assert.equal(photoEditSchema.safeParse({ ...base, context: 'travel' }).success, false);
    assert.equal(photoEditSchema.safeParse({ ...base, classification: 'record', featured: 'yes' }).success, false);
    assert.equal(photoEditSchema.safeParse({ ...base, status: 'draft', hotel_id: '' }).success, true);
});
test('Hotel photos and geographic projections omit notes, GPS and private storage fields', async () => {
    const requests: string[] = [];
    const client = createAnonymousClient(db, requests);
    const photos = await hotelPhotos(client, hotel);
    assert.deepEqual(photos.photos.map(p => p.id), [hotelPhoto]);
    assert.equal(photos.photos[0].place.hotel_slug, 'published-hotel');
    assert.equal(photos.photos[0].place.trip_slug, null);
    assert.equal(photos.photos[0].location_id, null);
    assert.equal((await queryHotel(client,'published-hotel'))?.review_text,'Public review');
    assert.doesNotMatch(JSON.stringify({ photos }), /PRIVATE NOTE|internal_notes|latitude|longitude|storage_key|file_hash/);
    assert.ok(requests.every(r => !r.includes('internal_notes') && !r.includes('latitude')));
    for (const table of ['photos'])
        await asRole(db, 'anon', null, () => assert.rejects(db.query(`select ${'latitude'} from public.${table}`), code('42501')));
});
test('safe Hotel covers use only eligible Nice Hotel photography; Record stays separate', async () => {
    const client = createAnonymousClient(db);
    assert.equal((await hotelCover(client, hotel))?.id, hotelPhoto);
    await db.query("update public.photos set classification='record' where id=$1", [hotelPhoto]);
    assert.equal(await hotelCover(client, hotel), null);
    assert.equal((await hotelPhotos(client, hotel,1,undefined,'record')).photos.length, 1);
    assert.ok((await contextualPhotos(client, 'trip_id', trip, 'nice')).photos.every(p => p.context === 'travel'));
    assert.equal((await hotelPhotos(client, hotel,1,undefined,'record')).photos.length, 1);
});
test('empty Hotel photography and no-review Hotels have intentional valid public payloads', async () => {
    const client = createAnonymousClient(db);
    await db.exec('delete from public.photos');
    const h = await queryHotel(client, 'published-hotel');
    assert.ok(h);
    assert.equal(await hotelCover(client, h.id), null);
    assert.equal((await hotelPhotos(client, hotel)).photos.length, 0);
    await db.query('update public.hotels set review_text=null where id=$1',[hotel]);
    assert.equal((await queryHotel(client,'published-hotel'))?.review_text,null);
    await db.query("update public.hotels set status='draft'");
    assert.equal((await queryHotelIndex(client)).hotels.length, 0);
});
test('new Hotel/import RPCs and table mutations reject anonymous and unrelated users', async () => {
    for (const role of ['anon', 'authenticated'] as const)
        await asRole(db, role, role === 'authenticated' ? other : null, async () => {
            for (const sql of ["select public.admin_save_hotel(null,'{}'::jsonb)", `select public.admin_reserve_context_photo_import('${randomUUID()}','${randomUUID()}','x.jpg',repeat('a',64),10,'nice','hotel',null)`])
                await assert.rejects(db.query(sql), code('42501'));
            for (const table of ['hotels']) {
                if (role === 'anon')
                    await assert.rejects(db.query(`delete from public.${table}`), code('42501'));
                else
                    assert.equal((await db.query(`delete from public.${table} returning id`)).rows.length, 0);
            }
        });
});
test('durable Hotel import assignment finalizes Draft Hotel photo and prevents retry context replacement', async () => owner(async () => {
    const batch = randomUUID(), id = randomUUID(), token = randomUUID();
    const hash = '1'.repeat(64);
    await db.query('select public.admin_create_import_batch($1,null,1,1,0)', [batch]);
    const input = { id, batch_id: batch, filename: 'hotel.jpg', path: '01 Nice/hotel.jpg', file_hash: hash, file_size: 100, classification: 'nice', context: 'hotel', hotel_id: hotel };
    assert.equal(prepareSchema.safeParse(input).success, true);
    const args = [id, batch, 'hotel.jpg', hash, 100, 'nice', 'hotel', hotel];
    await db.query('select public.admin_reserve_context_photo_import($1,$2,$3,$4,$5,$6,$7,$8)', args);
    await assert.rejects(db.query('select public.admin_reserve_context_photo_import($1,$2,$3,$4,$5,$6,$7,$8)', [...args.slice(0, 6), 'travel', null]), /another context or Hotel/);
    await db.query("select public.admin_claim_photo_import($1,$2,'prepare')", [id, token]);
    await db.query("select public.admin_mark_photo_upload($1,$2,'fake')", [id, token]);
    await db.query("select public.admin_claim_photo_import($1,$2,'process')", [id, token]);
    await db.query('select public.admin_finalize_photo_import($1,$2,$3::jsonb)', [id, token, JSON.stringify({ width: 800, height: 400, latitude: 1.2, longitude: 103.4 })]);
    const p = (await db.query<{
        context: string;
        hotel_id: string;
        status: string;
        location_id: null;
        trip_id: null;
    }>('select * from public.photos where id=$1', [id])).rows[0];
    assert.equal(p.context, 'hotel');
    assert.equal(p.hotel_id, hotel);
    assert.equal(p.location_id, null);
    assert.equal(p.trip_id, null);
    assert.equal(p.status, 'draft');
    await db.query('select public.admin_reserve_context_photo_import($1,$2,$3,$4,$5,$6,$7,$8)', args);
    assert.equal((await db.query<{
        hotel_id: null;
    }>('select hotel_id from public.import_items where id=$1', [id])).rows[0].hotel_id, null);
}));
test('Hotel gallery stays bounded without duplicating the cover', async () => {
    const client = createAnonymousClient(db);
    const ids: string[] = [];
    for (let i = 0; i < 49; i++) {
        const id = randomUUID();
        ids.push(id);
        await db.query("insert into public.photos(id,filename,storage_key,file_hash,width,height,file_size,classification,context,status,processing_status,hotel_id,editorial_order)values($1::uuid,'synthetic.jpg',$1::text,repeat('9',64),800,400,100,'nice','hotel','published','ready',$2,$3)", [id, hotel, i + 1]);
    }
    await db.query('update public.photos set editorial_order=0 where id=$1', [hotelPhoto]);
    const cover = await hotelCover(client, hotel);
    assert.equal(cover?.id, hotelPhoto);
    const first = await hotelPhotos(client, hotel, 1, cover?.id), next = await hotelPhotos(client, hotel, 2, cover?.id), last = await hotelPhotos(client, hotel, 3, cover?.id);
    assert.equal(first.photos.length, 24);
    assert.equal(next.photos.length, 24);
    assert.equal(last.photos.length, 1);
    assert.equal(last.hasNext, false);
    assert.deepEqual([...first.photos, ...next.photos, ...last.photos].map(p => p.id), ids);
    assert.equal((await hotelPhotos(client, hotel)).photos.length,24);
});

test('cleaned failed imports release temporary Hotel dependencies and retry revalidates the chosen Hotel', async () => owner(async () => {
  const target=await saveHotel(null), batch=randomUUID(), id=randomUUID(), token=randomUUID();
  await db.query('select public.admin_create_import_batch($1,null,1,1,0)',[batch]);
  const args=[id,batch,'temporary.jpg','2'.repeat(64),100,'nice','hotel',target];
  await db.query('select public.admin_reserve_context_photo_import($1,$2,$3,$4,$5,$6,$7,$8)',args);
  await assert.rejects(db.query('delete from public.hotels where id=$1',[target]),(error:unknown)=>code('23503')(error)||code('23001')(error));
  await db.query("select public.admin_claim_photo_import($1,$2,'prepare')",[id,token]);
  await db.query('select public.admin_fail_photo_import($1,$2,true)',[id,token]);
  assert.equal((await db.query<{hotel_id:null}>('select hotel_id from public.import_items where id=$1',[id])).rows[0].hotel_id,null);
  await db.query('delete from public.hotels where id=$1',[target]);
  await assert.rejects(db.query('select public.admin_reserve_context_photo_import($1,$2,$3,$4,$5,$6,$7,$8)',args),/existing Hotel/);
  await db.query('select public.admin_reserve_context_photo_import($1,$2,$3,$4,$5,$6,$7,$8)',[...args.slice(0,7),hotel]);
  assert.equal((await db.query<{hotel_id:string}>('select hotel_id from public.import_items where id=$1',[id])).rows[0].hotel_id,hotel);
}));
