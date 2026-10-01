import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { asRole, createTestDatabase } from './database';
import { createAnonymousClient } from './public-client';
import { hotelSchema, staySchema } from '../src/lib/validation/content';
import { photoEditSchema } from '../src/lib/validation/photo';
import { prepareSchema } from '../src/lib/photos/model';
import { queryHotel, queryHotelIndex, queryStay, relatedStays, stayPhotos, stayCover, hotelCover, hotelPhotos, recommendations } from '../src/lib/data/public-stays';
import { queryPhoto } from '../src/lib/data/public-photos';
import { contextualPhotos } from '../src/lib/data/public-places';
import { PhotoContextLinks } from '../src/components/public/journey';
import { StayDates, StayLinks } from '../src/components/public/stay';
let db: PGlite;
const admin = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
const hotel = '50000000-0000-4000-8000-000000000001', stay = '60000000-0000-4000-8000-000000000001', trip = '30000000-0000-4000-8000-000000000001', city = '20000000-0000-4000-8000-000000000001';
const hotelPhoto = '70000000-0000-4000-8000-000000000003';
const owner = <T>(run: () => Promise<T>) => asRole(db, 'authenticated', admin, run);
const code = (expected: string) => (e: unknown) => !!e && typeof e === 'object' && 'code' in e && e.code === expected;
before(async () => { db = await createTestDatabase(); });
after(async () => { await db?.close(); });
beforeEach(async () => { await db.exec('truncate public.countries,public.cities,public.locations,public.trips,public.trip_cities,public.trip_locations,public.hotels,public.stays,public.photos,public.import_items,public.import_batches,private.admin_identity,auth.users'); await db.exec(await readFile('supabase/tests/fixtures.sql', 'utf8')); });
const hotelInput = { name: 'New Hotel', slug: 'new-hotel', city_id: city, brand: '', address: '', description: '', latitude: '', longitude: '', rating: '', recommended_family: '', recommended_business: '', recommended_leisure: '', status: 'draft', editorial_order: '' };
const stayInput = { hotel_id: hotel, trip_id: trip, check_in: '', check_out: '', room_type: '', purpose: '', rating: '', review_text: '', internal_notes: '', status: 'draft', editorial_order: '' };
async function saveHotel(id: string | null, input = hotelInput) { const data = hotelSchema.parse(input); return (await db.query<{
    id: string;
}>('select public.admin_save_hotel($1,$2::jsonb) id', [id, JSON.stringify(data)])).rows[0].id; }
async function saveStay(id: string | null, input = stayInput) { const data = staySchema.parse(input); return (await db.query<{
    id: string;
}>('select public.admin_save_stay($1,$2::jsonb) id', [id, JSON.stringify(data)])).rows[0].id; }
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
test('Stay CRUD allows repeated Hotel visits and unknown dates/review; City membership is maintained', async () => owner(async () => {
    const first = await saveStay(null);
    const second = await saveStay(null);
    assert.notEqual(first, second);
    await saveStay(first, { ...stayInput, room_type: 'King', purpose: 'family', rating: '4', internal_notes: 'ONLY PRIVATE', review_text: 'Actual review' });
    assert.equal((await db.query<{
        check_in: null;
    }>('select check_in from public.stays where id=$1', [second])).rows[0].check_in, null);
    assert.equal((await db.query('select 1 from public.trip_cities where trip_id=$1 and city_id=$2', [trip, city])).rows.length, 1);
    await db.query('delete from public.stays where id=$1', [first]);
    assert.equal((await db.query('select id from public.hotels where id=$1', [hotel])).rows.length, 1);
    await assert.rejects(db.query('delete from public.stays where id=$1', [stay]), (e: unknown) => code('23503')(e) || code('23001')(e));
}));
test('Hotel City edits add new City to all Stay Trips and preserve explicit old memberships', async () => owner(async () => {
    const next = '20000000-0000-4000-8000-000000000002';
    await saveHotel(hotel, { ...hotelInput, name: 'Published Hotel', slug: 'published-hotel', city_id: next, status: 'published' });
    const ids = (await db.query<{
        city_id: string;
    }>('select city_id from public.trip_cities where trip_id=$1', [trip])).rows.map(r => r.city_id);
    assert.ok(ids.includes(city));
    assert.ok(ids.includes(next));
    await assert.rejects(db.query('select public.admin_remove_trip_city($1,$2)', [trip, next]), /used by a Location or Stay/);
}));
test('Stay historical endpoints and whole ratings reject invalid input without requiring invented information', async () => {
    assert.equal(staySchema.safeParse(stayInput).success, true);
    assert.equal(staySchema.safeParse({ ...stayInput, check_out: '2001-01-01' }).success, true);
    for (const input of [{ check_in: '2026-10-02', check_out: '2026-10-01' }, { rating: '3.5' }, { rating: '0' }, { rating: '6' }, { purpose: 'photography' }])
        assert.equal(staySchema.safeParse({ ...stayInput, ...input }).success, false);
    assert.deepEqual(recommendations({ ...hotelSchema.parse(hotelInput), recommended_family: true, recommended_leisure: true }), ['Family', 'Personal / Leisure']);
    await owner(async () => { await assert.rejects(db.query('select public.admin_save_stay(null,$1::jsonb)', [JSON.stringify({ ...staySchema.parse(stayInput), rating: 3.5 })]), code('23514')); await assert.rejects(db.query('select public.admin_save_hotel(null,$1::jsonb)', [JSON.stringify({ ...hotelSchema.parse(hotelInput), rating: 4.5 })]), code('23514')); });
});
test('Stay publication preflight requires actual Published Hotel and Trip; Draft association still valid', async () => owner(async () => {
    await assert.rejects(saveStay(null, { ...stayInput, hotel_id: '50000000-0000-4000-8000-000000000002', status: 'published' }), /published Trip and Hotel/);
    await assert.rejects(saveStay(null, { ...stayInput, trip_id: '30000000-0000-4000-8000-000000000002', status: 'published' }), /published Trip and Hotel/);
    await saveStay(null, { ...stayInput, status: 'published' });
    await saveStay(null, { ...stayInput, hotel_id: '50000000-0000-4000-8000-000000000002' });
}));
test('Hotel Photo validates Stay without Location and keeps mutually exclusive context and Featured rules', () => {
    const base = { context: 'hotel', stay_id: stay, trip_id: '', location_id: '', classification: 'nice', status: 'published', featured: '', caption: '', description: '', editorial_order: '' };
    assert.equal(photoEditSchema.safeParse(base).success, true);
    assert.equal(photoEditSchema.safeParse({ ...base, stay_id: '' }).success, false);
    assert.equal(photoEditSchema.safeParse({ ...base, trip_id: trip }).success, false);
    assert.equal(photoEditSchema.safeParse({ ...base, context: 'travel' }).success, false);
    assert.equal(photoEditSchema.safeParse({ ...base, classification: 'record', featured: 'yes' }).success, false);
    assert.equal(photoEditSchema.safeParse({ ...base, status: 'draft', stay_id: '' }).success, true);
});
test('public Hotel index shows each Hotel once; Stay lookup binds ID to Hotel and excludes Draft/hidden parents', async () => {
    const client = createAnonymousClient(db);
    await owner(() => saveStay(null, { ...stayInput, status: 'published' }));
    const index = await queryHotelIndex(client);
    assert.equal(index.hotels.length, 1);
    assert.equal(index.hotels[0].slug, 'published-hotel');
    assert.equal(await queryHotel(client, 'draft-hotel'), null);
    assert.ok(await queryStay(client, hotel, stay));
    assert.equal(await queryStay(client, hotel, '60000000-0000-4000-8000-000000000002'), null);
    assert.equal(await queryStay(client, hotel, '60000000-0000-4000-8000-000000000004'), null);
    await db.query("update public.trips set status='draft' where id=$1", [trip]);
    assert.equal(await queryStay(client, hotel, stay), null);
    assert.ok(await queryHotel(client, 'published-hotel'));
    assert.equal(await hotelCover(client, hotel), null);
});
test('Hotel/Stay photos and geographic projections omit notes, GPS and private storage fields', async () => {
    const requests: string[] = [];
    const client = createAnonymousClient(db, requests);
    const photos = await stayPhotos(client, stay, 'nice');
    assert.deepEqual(photos.photos.map(p => p.id), [hotelPhoto]);
    assert.equal(photos.photos[0].place.hotel_slug, 'published-hotel');
    assert.equal(photos.photos[0].place.trip_slug, 'published-trip');
    assert.equal(photos.photos[0].location_id, null);
    const related = await relatedStays(client, 'hotel_id', hotel);
    assert.equal(related.stays.length, 1);
    assert.equal(related.stays[0].review_text, 'Public review');
    assert.doesNotMatch(JSON.stringify({ photos, related }), /PRIVATE NOTE|internal_notes|latitude|longitude|storage_key|file_hash/);
    assert.ok(requests.every(r => !r.includes('internal_notes') && !r.includes('latitude')));
    for (const table of ['stays', 'photos'])
        await asRole(db, 'anon', null, () => assert.rejects(db.query(`select ${table === 'stays' ? 'internal_notes' : 'latitude'} from public.${table}`), code('42501')));
});
test('safe Hotel and Stay covers use only eligible Nice Hotel photography; Record stays separate', async () => {
    const client = createAnonymousClient(db);
    assert.equal((await stayCover(client, stay))?.id, hotelPhoto);
    assert.equal((await hotelCover(client, hotel))?.id, hotelPhoto);
    await db.query("update public.photos set classification='record' where id=$1", [hotelPhoto]);
    assert.equal(await stayCover(client, stay), null);
    assert.equal(await hotelCover(client, hotel), null);
    assert.equal((await stayPhotos(client, stay, 'record')).photos.length, 1);
    assert.ok((await contextualPhotos(client, 'trip_id', trip, 'nice')).photos.every(p => p.context === 'travel'));
    await db.query("update public.stays set status='draft' where id=$1", [stay]);
    assert.equal((await stayPhotos(client, stay, 'record')).photos.length, 0);
});
test('Photo→Hotel/Stay/Trip and Trip→Stay links use established URLs; undated states invent no date', async () => {
    const client = createAnonymousClient(db);
    const photo = await queryPhoto(client, hotelPhoto);
    assert.ok(photo);
    const html = renderToStaticMarkup(React.createElement(PhotoContextLinks, { photo }));
    assert.match(html, /href="\/stays\/published-hotel"/);
    assert.match(html, new RegExp(`/stays/published-hotel/${stay}`));
    assert.match(html, /\/trips\/published-trip/);
    assert.doesNotMatch(html, /\/locations\//);
    const related = await relatedStays(client, 'trip_id', trip);
    const links = renderToStaticMarkup(React.createElement(StayLinks, { stays: related.stays }));
    assert.match(links, new RegExp(`/stays/published-hotel/${stay}`));
    assert.match(links, /Dates not recorded/);
    const dates = renderToStaticMarkup(React.createElement(StayDates, { stay: { check_in: null, check_out: null } }));
    assert.doesNotMatch(dates, /1970|2026/);
});
test('empty Hotel/Stay photography and no-review visits have intentional valid public payloads', async () => {
    const client = createAnonymousClient(db);
    await db.exec('delete from public.photos');
    const h = await queryHotel(client, 'published-hotel');
    assert.ok(h);
    assert.equal(await hotelCover(client, h.id), null);
    assert.equal((await stayPhotos(client, stay, 'nice')).photos.length, 0);
    await db.query('update public.stays set review_text=null where id=$1', [stay]);
    assert.equal((await queryStay(client, hotel, stay))?.review_text, null);
    await db.query("update public.hotels set status='draft'");
    assert.equal((await queryHotelIndex(client)).hotels.length, 0);
});
test('new Hotel/Stay/import RPCs and table mutations reject anonymous and unrelated users', async () => {
    for (const role of ['anon', 'authenticated'] as const)
        await asRole(db, role, role === 'authenticated' ? other : null, async () => {
            for (const sql of ["select public.admin_save_hotel(null,'{}'::jsonb)", "select public.admin_save_stay(null,'{}'::jsonb)", `select public.admin_reserve_context_photo_import('${randomUUID()}','${randomUUID()}','x.jpg',repeat('a',64),10,'nice','hotel',null)`])
                await assert.rejects(db.query(sql), code('42501'));
            for (const table of ['hotels', 'stays']) {
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
    const input = { id, batch_id: batch, filename: 'hotel.jpg', path: '01 Nice/hotel.jpg', file_hash: hash, file_size: 100, classification: 'nice', context: 'hotel', stay_id: stay };
    assert.equal(prepareSchema.safeParse(input).success, true);
    const args = [id, batch, 'hotel.jpg', hash, 100, 'nice', 'hotel', stay];
    await db.query('select public.admin_reserve_context_photo_import($1,$2,$3,$4,$5,$6,$7,$8)', args);
    await assert.rejects(db.query('select public.admin_reserve_context_photo_import($1,$2,$3,$4,$5,$6,$7,$8)', [...args.slice(0, 6), 'travel', null]), /another context or Stay/);
    await db.query("select public.admin_claim_photo_import($1,$2,'prepare')", [id, token]);
    await db.query("select public.admin_mark_photo_upload($1,$2,'fake')", [id, token]);
    await db.query("select public.admin_claim_photo_import($1,$2,'process')", [id, token]);
    await db.query('select public.admin_finalize_photo_import($1,$2,$3::jsonb)', [id, token, JSON.stringify({ width: 800, height: 400, latitude: 1.2, longitude: 103.4 })]);
    const p = (await db.query<{
        context: string;
        stay_id: string;
        status: string;
        location_id: null;
        trip_id: null;
    }>('select * from public.photos where id=$1', [id])).rows[0];
    assert.equal(p.context, 'hotel');
    assert.equal(p.stay_id, stay);
    assert.equal(p.location_id, null);
    assert.equal(p.trip_id, null);
    assert.equal(p.status, 'draft');
    await db.query('select public.admin_reserve_context_photo_import($1,$2,$3,$4,$5,$6,$7,$8)', args);
    assert.equal((await db.query<{
        stay_id: null;
    }>('select stay_id from public.import_items where id=$1', [id])).rows[0].stay_id, null);
}));
test('Hotel gallery spans public visits, excludes hidden Stays and stays bounded without duplicating the cover', async () => {
    const client = createAnonymousClient(db);
    const second = randomUUID();
    await db.query("insert into public.stays(id,hotel_id,trip_id,status)values($1,$2,$3,'published')", [second, hotel, trip]);
    const ids: string[] = [];
    for (let i = 0; i < 49; i++) {
        const id = randomUUID();
        ids.push(id);
        await db.query("insert into public.photos(id,filename,storage_key,file_hash,width,height,file_size,classification,context,status,processing_status,stay_id,editorial_order)values($1::uuid,'synthetic.jpg',$1::text,repeat('9',64),800,400,100,'nice','hotel','published','ready',$2,$3)", [id, second, i + 1]);
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
    await db.query("update public.stays set status='draft' where id=$1", [second]);
    assert.deepEqual((await hotelPhotos(client, hotel)).photos.map(p => p.id), [hotelPhoto]);
});

test('cleaned failed imports release temporary Stay dependencies and retry revalidates the chosen Stay', async () => owner(async () => {
  const target=await saveStay(null), batch=randomUUID(), id=randomUUID(), token=randomUUID();
  await db.query('select public.admin_create_import_batch($1,null,1,1,0)',[batch]);
  const args=[id,batch,'temporary.jpg','2'.repeat(64),100,'nice','hotel',target];
  await db.query('select public.admin_reserve_context_photo_import($1,$2,$3,$4,$5,$6,$7,$8)',args);
  await assert.rejects(db.query('delete from public.stays where id=$1',[target]),(error:unknown)=>code('23503')(error)||code('23001')(error));
  await db.query("select public.admin_claim_photo_import($1,$2,'prepare')",[id,token]);
  await db.query('select public.admin_fail_photo_import($1,$2,true)',[id,token]);
  assert.equal((await db.query<{stay_id:null}>('select stay_id from public.import_items where id=$1',[id])).rows[0].stay_id,null);
  await db.query('delete from public.stays where id=$1',[target]);
  await assert.rejects(db.query('select public.admin_reserve_context_photo_import($1,$2,$3,$4,$5,$6,$7,$8)',args),/existing Stay/);
  await db.query('select public.admin_reserve_context_photo_import($1,$2,$3,$4,$5,$6,$7,$8)',[...args.slice(0,7),stay]);
  assert.equal((await db.query<{stay_id:string}>('select stay_id from public.import_items where id=$1',[id])).rows[0].stay_id,stay);
}));
