import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createTestDatabase } from './database';

let db: PGlite;
const admin = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const trip = '30000000-0000-4000-8000-000000000001';
const city = '20000000-0000-4000-8000-000000000001';
const country = '10000000-0000-4000-8000-000000000001';
const location = '40000000-0000-4000-8000-000000000001';
const owner = <T>(fn: () => Promise<T>) => asRole(db, 'authenticated', admin, fn);
const code = (value: string) => (error: unknown) => !!error && typeof error === 'object' && 'code' in error && error.code === value;
before(async () => { db = await createTestDatabase(); });
after(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec('truncate public.countries,public.cities,public.locations,public.trips,public.trip_cities,public.trip_locations,public.hotels,public.stays,public.photos,public.import_items,public.import_batches,private.admin_identity,auth.users');
  await db.exec(await readFile('supabase/tests/fixtures.sql', 'utf8'));
});
async function newTrip(slug = 'new-trip') {
  return (await db.query<{ id: string }>('insert into public.trips(title,slug) values ($1,$2) returning id', ['Undated Trip', slug])).rows[0].id;
}
async function newLocation(tripId: string | null = null) {
  return (await db.query<{ id: string }>('select public.admin_save_location(null,$1,$2,$3,p_trip_id=>$4) as id', [city, 'New Castle', 'new-castle', tripId])).rows[0].id;
}
test('administrator creates, edits and safely deletes an undated Trip', async () => owner(async () => {
  const id = await newTrip();
  const row = (await db.query<{ start_date: null; end_date: null }>('select start_date,end_date from public.trips where id=$1', [id])).rows[0];
  assert.deepEqual(row, { start_date: null, end_date: null });
  await db.query("update public.trips set title='Edited',status='published',purpose='photography',end_date='1999-01-01' where id=$1", [id]);
  await assert.rejects(db.query("update public.trips set start_date='2000-01-01' where id=$1", [id]), code('23514'));
  await db.query('select public.admin_delete_trip($1)', [id]);
  assert.equal((await db.query('select id from public.trips where id=$1', [id])).rows.length, 0);
}));
test('inline Country/City creation is atomic, reuses identities and preserves coordinates', async () => owner(async () => {
  const args = ['Kyoto', 'kyoto', 'Japan', 'JP', 'japan'];
  const sql = 'select public.admin_create_city($1,$2,null,$3,$4,$5,35,135) as id';
  const first = (await db.query<{ id: string }>(sql, args)).rows[0].id;
  assert.equal((await db.query<{ id: string }>(sql, args)).rows[0].id, first);
  await db.query('select public.admin_create_city($1,$2,null,$3,$4,$5,0,0)', args);
  assert.equal(Number((await db.query<{ latitude: number }>('select latitude from public.cities where id=$1', [first])).rows[0].latitude), 35);
  assert.equal((await db.query("select id from public.countries where code='JP'")).rows.length, 1);
  await assert.rejects(db.query(sql, ['Osaka', 'osaka', 'Wrong Country', 'JP', 'wrong-country']), code('P0001'));
  await assert.rejects(db.query(sql, ['Bad City', 'bad-city', 'Another Country', 'AC', 'bad_slug']), code('23514'));
  assert.equal((await db.query("select id from public.countries where code='AC'")).rows.length, 0);
  await assert.rejects(db.query('select public.admin_create_city($1,$2,null,$3,$4,$5,91,0)', ['Invalid City', 'invalid-city', 'Temporary Country', 'TC', 'temporary-country']), code('23514'));
  assert.equal((await db.query("select id from public.countries where code='TC'")).rows.length, 0);
  const existing = (await db.query<{ id: string }>('select public.admin_create_city($1,$2,$3) as id', ['Supporting City', 'supporting-city', country])).rows[0].id;
  assert.ok(existing);
  await assert.rejects(db.query('select public.admin_create_city($1,$2,$3)', ['Different name', 'supporting-city', country]), code('P0001'));
}));
test('Location CRUD requires geographic integrity and transactionally attaches to a Trip', async () => owner(async () => {
  const id = await newLocation();
  await db.query("select public.admin_save_location($1,$2,'Edited Castle','new-castle',1,2,'Description','published',3)", [id, city]);
  assert.equal((await db.query<{ name: string }>('select name from public.locations where id=$1', [id])).rows[0].name, 'Edited Castle');
  await db.query('delete from public.locations where id=$1', [id]);
  const missing = '90000000-0000-4000-8000-000000000001';
  await assert.rejects(newLocation(missing), code('P0001'));
  assert.equal((await db.query("select id from public.locations where slug='new-castle'")).rows.length, 0);
  await assert.rejects(db.query("select public.admin_save_location(null,$1,'Missing City','missing-city')", [missing]), code('23503'));
}));
test('many-to-many membership includes City, preserves sequence and allows unknown chronology', async () => owner(async () => {
  const a = await newTrip('trip-a'); const b = await newTrip('trip-b'); const id = await newLocation(a);
  await db.query('select public.admin_set_trip_city($1,$2,7)', [a, city]);
  await db.query('select public.admin_set_trip_location($1,$2,3,null)', [a, id]);
  await db.query('select public.admin_set_trip_location($1,$2,null,null)', [b, id]);
  assert.equal((await db.query('select * from public.trip_locations where location_id=$1', [id])).rows.length, 2);
  assert.equal((await db.query<{ sequence: number }>('select sequence from public.trip_cities where trip_id=$1 and city_id=$2', [a, city])).rows[0].sequence, 7);
  await db.query("select public.admin_set_trip_location($1,$2,2,'1990-01-01')", [a, id]);
  await assert.rejects(db.query('select public.admin_remove_trip_city($1,$2)', [a, city]), code('P0001'));
  await db.query('select public.admin_remove_trip_location($1,$2)', [a, id]);
  await db.query('select public.admin_remove_trip_city($1,$2)', [a, city]);
  assert.equal((await db.query('select id from public.locations where id=$1', [id])).rows.length, 1);
  assert.equal((await db.query('select city_id from public.trip_cities where trip_id=$1', [b])).rows.length, 1);
}));
test('changing a shared Location City maintains every Trip and retains explicit old membership', async () => owner(async () => {
  const a = await newTrip('trip-a'); const b = await newTrip('trip-b'); const id = await newLocation(a);
  await db.query('select public.admin_set_trip_location($1,$2)', [b, id]);
  const newCity = (await db.query<{ id: string }>("select public.admin_create_city('Second City','second-city',$1) as id", [country])).rows[0].id;
  await db.query("select public.admin_save_location($1,$2,'New Castle','new-castle')", [id, newCity]);
  for (const t of [a, b]) assert.equal((await db.query('select city_id from public.trip_cities where trip_id=$1', [t])).rows.length, 2);
}));
test('Trip deletion preserves shared archive records; referenced Photos/Stays and joins block destruction', async () => owner(async () => {
  const id = await newTrip(); const l = await newLocation(id);
  await db.query('select public.admin_delete_trip($1)', [id]);
  assert.equal((await db.query('select id from public.locations where id=$1', [l])).rows.length, 1);
  assert.equal((await db.query('select id from public.cities where id=$1', [city])).rows.length, 1);
  await assert.rejects(db.query('select public.admin_delete_trip($1)', [trip]), code('P0001'));
  await assert.rejects(db.query('select public.admin_remove_trip_location($1,$2)', [trip, location]), (error: unknown) => code('23503')(error) || code('23001')(error));
  await assert.rejects(db.query('delete from public.locations where id=$1', [location]), (error: unknown) => code('23503')(error) || code('23001')(error));
  assert.equal((await db.query('select trip_id from public.trip_locations where trip_id=$1', [trip])).rows.length, 2);
}));
test('all workflow RPCs reject anonymous and unrelated authenticated users', async () => {
  const calls = [
    "select public.admin_create_city('Intrusion','intrusion')",
    `select public.admin_save_location(null,'${city}','Intrusion','intrusion')`,
    `select public.admin_set_trip_city('${trip}','${city}')`,
    `select public.admin_remove_trip_city('${trip}','${city}')`,
    `select public.admin_set_trip_location('${trip}','${location}')`,
    `select public.admin_remove_trip_location('${trip}','${location}')`,
    `select public.admin_delete_trip('${trip}')`,
  ];
  for (const role of ['anon', 'authenticated'] as const) await asRole(db, role, role === 'authenticated' ? other : null, async () => {
    for (const sql of calls) await assert.rejects(db.query(sql), code('42501'));
    for (const table of ['countries', 'cities', 'locations', 'trip_cities', 'trip_locations']) {
      if (role === 'anon') await assert.rejects(db.query(`delete from public.${table}`), code('42501'));
      else assert.equal((await db.query(`delete from public.${table} returning *`)).rows.length, 0);
    }
  });
  const { rows } = await db.query<{ prosecdef: boolean; proconfig: string[] }>("select prosecdef,proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like 'admin_%'");
  assert.equal(rows.length, 17);
  assert.ok(rows.every((row) => !row.prosecdef && row.proconfig.includes('search_path=""')));
});
