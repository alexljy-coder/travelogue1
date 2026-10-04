import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDatabase, asRole } from './database';
import { publicPhotoColumns } from '../src/lib/data/public-columns';

let db: PGlite;
const admin = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const trip = '30000000-0000-4000-8000-000000000001';
const location = '40000000-0000-4000-8000-000000000001';
const hotel = '50000000-0000-4000-8000-000000000001';
const photo = '70000000-0000-4000-8000-000000000001';
const tables = ['countries', 'cities', 'locations', 'trips', 'trip_cities', 'trip_locations', 'hotels', 'photos', 'import_batches', 'import_items'];
const errorCode = (code: string) => (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === code;
// PostgreSQL versions can report RESTRICT as restrict_violation or foreign_key_violation.
const restrictedDeletion = (error: unknown) => errorCode('23001')(error) || errorCode('23503')(error);
const anon = <T>(run: () => Promise<T>) => asRole(db, 'anon', null, run);
const owner = <T>(run: () => Promise<T>) => asRole(db, 'authenticated', admin, run);

before(async () => { db = await createTestDatabase(); });
after(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`truncate ${tables.map((table) => `public.${table}`).join(',')},private.admin_identity,auth.users`);
  await db.exec(await readFile('supabase/tests/fixtures.sql', 'utf8'));
});

test('migrations enable RLS on all archive tables and singleton identity', async () => {
  const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>("select relname,relrowsecurity from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname in ('public','private') and c.relkind='r'");
  assert.equal(rows.length, tables.length + 1);
  assert.ok(rows.every((row) => row.relrowsecurity));
  const { rows: columns } = await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_name='photos' and table_schema='public'");
  assert.ok(!columns.some((column) => column.column_name === 'slug'));
});

test('anonymous direct lookup and joins reveal only effectively published rows', async () => {
  await anon(async () => {
    assert.equal((await db.query('select id from public.trips')).rows.length, 1);
    assert.equal((await db.query('select id from public.locations')).rows.length, 1);
    assert.equal((await db.query('select id from public.hotels')).rows.length, 1);
    assert.equal((await db.query('select trip_id from public.trip_locations')).rows.length, 1);
    assert.equal((await db.query('select trip_id from public.trip_cities')).rows.length, 1);
    assert.equal((await db.query('select id from public.cities')).rows.length, 1);
    assert.equal((await db.query('select id from public.countries')).rows.length, 1);
    assert.equal((await db.query('select id from public.photos')).rows.length, 3);
    assert.equal((await db.query("select id from public.photos where id='70000000-0000-4000-8000-000000000004'")).rows.length, 0);
    assert.equal((await db.query('select p.id from public.photos p join public.trips t on t.id=p.trip_id')).rows.length, 2);
    assert.equal((await db.query("select id from public.photos where classification='nice' and context='travel'")).rows.length, 1);
  });
});

test('photo GPS/storage metadata cannot be selected publicly', async () => {
  await anon(async () => {
    assert.equal((await db.query(`select ${publicPhotoColumns.join(',')} from public.photos`)).rows.length, 3);
    for (const column of ['latitude','longitude','filename','storage_key','file_hash','import_batch_id','captured_at_offset_minutes','processing_status']) {
      await assert.rejects(db.query(`select ${column} from public.photos`), errorCode('42501'));
    }
    await assert.rejects(db.query('select * from public.photos'), errorCode('42501'));
    await assert.rejects(db.query('select id from public.photos where latitude=1.2'), errorCode('42501'));
    await assert.rejects(db.query('select id from public.photos order by longitude'), errorCode('42501'));
    await assert.rejects(db.query('create table public.intrusion(id integer)'), errorCode('42501'));
    await assert.rejects(db.query('select * from public.import_batches'), errorCode('42501'));
    await assert.rejects(db.query('select * from private.admin_identity'), errorCode('42501'));
    await assert.rejects(db.query('select public.is_admin()'), errorCode('42501'));
  });
});

test('anonymous cannot insert/update/delete or bypass protection with a forged JWT setting', async () => {
  await asRole(db, 'anon', admin, async () => {
    await assert.rejects(db.query("insert into public.trips(title,slug) values ('Intrusion','intrusion')"), errorCode('42501'));
    await assert.rejects(db.query("update public.trips set title='Intrusion'"), errorCode('42501'));
    await assert.rejects(db.query('delete from public.trips'), errorCode('42501'));
  });
});

test('unrelated authenticated user sees zero rows including private fields and cannot mutate', async () => {
  await asRole(db, 'authenticated', other, async () => {
    assert.equal((await db.query<{ is_admin: boolean }>('select public.is_admin()')).rows[0].is_admin, false);
    for (const table of tables) assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0, table);
    await assert.rejects(db.query("insert into public.trips(title,slug) values ('Intrusion','intrusion')"), errorCode('42501'));
    assert.equal((await db.query("update public.trips set title='Intrusion' returning id")).rows.length, 0);
    assert.equal((await db.query('delete from public.photos returning id')).rows.length, 0);
    await assert.rejects(db.query('insert into private.admin_identity(user_id) values ($1)', [other]), errorCode('42501'));
  });
});

test('administrator can read private columns and CRUD; no identity fails closed', async () => {
  await owner(async () => {
    assert.equal((await db.query<{ is_admin: boolean }>('select public.is_admin()')).rows[0].is_admin, true);
    assert.equal((await db.query('select * from public.photos')).rows.length, 9);
    const { rows } = await db.query<{ id: string }>("insert into public.trips(title,slug) values ('Undated','undated') returning id");
    assert.equal((await db.query('update public.trips set description=$1 where id=$2 returning id', ['Edited',rows[0].id])).rows.length, 1);
    assert.equal((await db.query('delete from public.trips where id=$1 returning id', [rows[0].id])).rows.length, 1);
  });
  await db.exec('delete from private.admin_identity');
  await owner(async () => {
    assert.equal((await db.query<{ is_admin: boolean }>('select public.is_admin()')).rows[0].is_admin, false);
    assert.equal((await db.query('select * from public.trips')).rows.length, 0);
    await assert.rejects(db.query("insert into public.trips(title,slug) values ('No identity','no-identity')"), errorCode('42501'));
  });
});

test('identity accepts only one administrator and is not publicly editable', async () => {
  await assert.rejects(db.query('insert into private.admin_identity(user_id) values ($1)', [other]), errorCode('23505'));
  await assert.rejects(db.query('insert into private.admin_identity(singleton,user_id) values (false,$1)', [other]), errorCode('23514'));
  await owner(async () => { await assert.rejects(db.query('update private.admin_identity set user_id=$1', [other]), errorCode('42501')); });
});

test('unpublishing Trip hides Travel children independently of Hotel without changing their states', async () => {
  await owner(async () => { await db.query("update public.trips set status='draft' where id=$1", [trip]); });
  await anon(async () => {
    assert.equal((await db.query('select id from public.photos')).rows.length, 1);
    assert.equal((await db.query('select trip_id from public.trip_locations')).rows.length, 0);
  });
  assert.equal((await db.query<{ status: string }>('select status from public.photos where id=$1', [photo])).rows[0].status, 'published');
});

test('unpublishing Hotel or Location hides the corresponding photos', async () => {
  for (const [table, id, expected] of [['hotels',hotel,2],['locations',location,1]] as const) {
    await db.query(`update public.${table} set status='draft' where id=$1`, [id]);
    await anon(async () => assert.equal((await db.query('select id from public.photos')).rows.length, expected));
    await db.query(`update public.${table} set status='published' where id=$1`, [id]);
  }
});

test('optional dates permit unknown/partial values; known reversed dates fail', async () => {
  await db.query('update public.trips set start_date=null,end_date=$1 where id=$2', ['2024-01-01',trip]);
  await assert.rejects(db.query('update public.trips set start_date=$1,end_date=$2 where id=$3', ['2024-02-01','2024-01-01',trip]), errorCode('23514'));
});

test('published photo assignments/readiness and mutually exclusive contexts are enforced', async () => {
  await assert.rejects(db.query('update public.photos set trip_id=null where id=$1',[photo]), errorCode('23514'));
  await assert.rejects(db.query('update public.photos set location_id=null where id=$1',[photo]), errorCode('23514'));
  await assert.rejects(db.query('update public.photos set hotel_id=$1 where id=$2',[hotel,photo]), errorCode('23514'));
  await assert.rejects(db.query("update public.photos set processing_status='pending' where id=$1",[photo]), errorCode('23514'));
  await assert.rejects(db.query("update public.photos set hotel_id=null where id='70000000-0000-4000-8000-000000000003'"), errorCode('23514'));
  await assert.rejects(db.query("update public.photos set trip_id=$1 where id='70000000-0000-4000-8000-000000000003'",[trip]), errorCode('23514'));
  await db.query("update public.photos set context='hotel' where id='70000000-0000-4000-8000-000000000008'");
});

test('Travel photo requires actual Trip–Location association; join pairs are unique', async () => {
  await assert.rejects(db.query("update public.photos set trip_id='30000000-0000-4000-8000-000000000002',location_id='40000000-0000-4000-8000-000000000002' where id=$1",[photo]),errorCode('23503'));
  await assert.rejects(db.query('insert into public.trip_locations(trip_id,location_id) values ($1,$2)',[trip,location]),errorCode('23505'));
  await assert.rejects(db.query("insert into public.trip_cities(trip_id,city_id) values ($1,'20000000-0000-4000-8000-000000000001')",[trip]),errorCode('23505'));
});

test('Featured requires Published and Nice; Personal is not a database classification', async () => {
  await db.query('update public.photos set featured=true where id=$1',[photo]);
  await assert.rejects(db.query("update public.photos set status='draft' where id=$1",[photo]),errorCode('23514'));
  await assert.rejects(db.query("update public.photos set classification='record' where id=$1",[photo]),errorCode('23514'));
  await assert.rejects(db.query("update public.photos set featured=true where id='70000000-0000-4000-8000-000000000008'"),errorCode('23514'));
  await assert.rejects(db.query("update public.photos set classification='personal' where id=$1",[photo]),errorCode('23514'));
  // Deliberately demoting a photo must clear Featured in the same update.
  await db.query("update public.photos set status='draft',featured=false where id=$1",[photo]);
});

test('deletion of referenced records and used joins is restricted; stale covers cannot expose drafts', async () => {
  await assert.rejects(db.query('delete from public.hotels where id=$1',[hotel]),restrictedDeletion);
  await assert.rejects(db.query('delete from public.locations where id=$1',[location]),restrictedDeletion);
  await assert.rejects(db.query('delete from public.trips where id=$1',[trip]),restrictedDeletion);
  await assert.rejects(db.query('delete from public.trip_locations where trip_id=$1 and location_id=$2',[trip,location]),restrictedDeletion);
  await db.query('update public.trips set cover_photo_id=$1 where id=$2',[photo,trip]);
  await assert.rejects(db.query('delete from public.photos where id=$1',[photo]),restrictedDeletion);
  await db.query("update public.photos set status='draft' where id=$1",[photo]);
  await anon(async () => {
    assert.equal((await db.query('select p.id from public.trips t join public.photos p on p.id=t.cover_photo_id where t.id=$1',[trip])).rows.length,0);
  });
});

test('coordinates, metadata, import counts and ordering reject invalid values', async () => {
  await assert.rejects(db.query('update public.photos set latitude=91 where id=$1',[photo]),errorCode('23514'));
  await assert.rejects(db.query('update public.photos set longitude=null where id=$1',[photo]),errorCode('23514'));
  await assert.rejects(db.query('update public.photos set width=0 where id=$1',[photo]),errorCode('23514'));
  await assert.rejects(db.query('update public.photos set iso=0 where id=$1',[photo]),errorCode('23514'));
  await assert.rejects(db.query('update public.photos set captured_at_offset_minutes=841 where id=$1',[photo]),errorCode('23514'));
  await assert.rejects(db.query('update public.photos set editorial_order=-1 where id=$1',[photo]),errorCode('23514'));
  await assert.rejects(db.query('update public.import_batches set imported=3'),errorCode('23514'));
  await db.query('update public.photos set captured_at=$1,captured_at_offset_minutes=null where id=$2',['2024-01-01 12:34:56',photo]);
});
