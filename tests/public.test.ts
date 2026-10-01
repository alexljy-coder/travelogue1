import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import type { PGlite } from '@electric-sql/pglite';
import type { Database } from '../src/types/database';
import { createTestDatabase, asRole } from './database';
import { attachContexts, orderedPhotos, photoProjection, queryPhoto, selectHomepagePhotos } from '../src/lib/data/public-photos';
import { deliverPublicImage, publicVariants } from '../src/lib/photos/public-image';
import { responsiveSources } from '../src/components/public/photograph';

let db: PGlite;
const id = (n: number) => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const requests: string[] = [];
// Exercise the actual supabase-js query builder/projection through anonymous
// PostgreSQL, without production credentials or a fabricated RLS implementation.
function publicClient() {
  return createClient<Database>('https://fixture.supabase.co', 'anonymous-fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer anonymous-fixture-key');
      const table = url.pathname.split('/').at(-1)!;
      assert.ok(['photos','locations','trips','cities','countries'].includes(table));
      const select = url.searchParams.get('select')!;
      assert.ok(/^[a-z_,]+$/.test(select));
      requests.push(`${table}:${select}`);
      const values: string[] = []; const conditions: string[] = [];
      for (const [key, value] of url.searchParams) {
        if (['select','order','limit','offset'].includes(key)) continue;
        assert.ok(/^[a-z_]+$/.test(key));
        if (value.startsWith('eq.')) { values.push(value.slice(3)); conditions.push(`${key}=$${values.length}`); }
        else if (value.startsWith('in.(')) {
          const items = value.slice(4,-1).split(',');
          conditions.push(`${key} in (${items.map((item) => { values.push(item); return `$${values.length}`; }).join(',')})`);
        } else throw new Error('Unexpected filter');
      }
      const ordering = url.searchParams.get('order')?.split(',').map((term) => {
        const [field, direction, nulls] = term.split('.');
        assert.ok(/^[a-z_]+$/.test(field)); assert.ok(['asc','desc'].includes(direction));
        return `${field} ${direction} ${nulls === 'nullslast' ? 'nulls last' : nulls === 'nullsfirst' ? 'nulls first' : ''}`;
      }).join(',');
      const sql = `select ${select} from public.${table}${conditions.length ? ` where ${conditions.join(' and ')}` : ''}${ordering ? ` order by ${ordering}` : ''} limit ${Number(url.searchParams.get('limit') ?? 100)} offset ${Number(url.searchParams.get('offset') ?? 0)}`;
      const rows = await asRole(db, 'anon', null, async () => (await db.query(sql, values)).rows);
      // supabase-js maybeSingle requests an array and normalizes zero/one rows.
      return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } });
    } },
  });
}
before(async () => { db = await createTestDatabase(); });
after(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec('truncate public.import_items,public.import_batches,public.photos,public.trip_locations,public.trip_cities,public.stays,public.hotels,public.locations,public.trips,public.cities,public.countries,private.admin_identity,auth.users');
  await db.exec(await readFile('supabase/tests/fixtures.sql', 'utf8'));
  requests.length = 0;
});

test('public query includes only effectively Published photos and excludes private fields', async () => {
  const { data, error } = await orderedPhotos(publicClient());
  assert.equal(error, null); assert.ok(data);
  assert.deepEqual(data.map((p) => p.id).sort(), [id(1), id(2), id(3)]);
  for (const row of data) {
    assert.deepEqual(Object.keys(row).sort(), photoProjection.split(',').sort());
    assert.ok(!('latitude' in row)); assert.ok(!('longitude' in row)); assert.ok(!('storage_key' in row));
  }
  assert.ok(requests.every((query) => !/internal_notes|latitude|longitude|storage_key|\*/.test(query)));
});
test('public detail: Published record with real geography; Draft, missing and unpublished parents return null', async () => {
  const client = publicClient();
  const photo = await queryPhoto(client, id(1));
  assert.ok(photo); assert.equal(photo.place.location, 'Published Location'); assert.equal(photo.place.trip, 'Published Trip');
  assert.ok(!JSON.stringify(photo).includes('PRIVATE NOTE'));
  for (const number of [4,5,6,7,8,9,999]) assert.equal(await queryPhoto(client, id(number)), null);
  assert.equal(await queryPhoto(client, 'not-uuid'), null);
  await db.exec("update public.trips set status='draft' where slug='published-trip'");
  assert.equal(await queryPhoto(client, id(1)), null);
  assert.equal(await queryPhoto(client, id(3)), null);
});
test('Nice default and explicit Record selections do not mix; empty archive is valid', async () => {
  const client = publicClient();
  const nice = await orderedPhotos(client).eq('classification', 'nice');
  const record = await orderedPhotos(client).eq('classification', 'record');
  assert.equal(nice.data?.length, 2); assert.deepEqual(record.data?.map((p) => p.id), [id(2)]);
  await db.exec("update public.photos set status='draft',featured=false");
  const empty = await orderedPhotos(client); assert.deepEqual(empty.data, []);
  assert.deepEqual(await attachContexts(client, []), []);
});
test('homepage prioritizes Featured Nice, deduplicates, fills from other Nice and supports zero/one', async () => {
  const { data } = await orderedPhotos(publicClient()); assert.ok(data);
  const featured = { ...data[0], featured: true };
  const record = data.find((p) => p.classification === 'record')!;
  const recent = [featured, ...data];
  const result = selectHomepagePhotos([record, featured], recent);
  assert.equal(result[0].id, featured.id);
  assert.equal(new Set(result.map((p) => p.id)).size, result.length);
  assert.ok(result.every((p) => p.classification === 'nice'));
  assert.equal(result.length, 2);
  assert.deepEqual(selectHomepagePhotos([], []), []);
  assert.equal(selectHomepagePhotos([], [featured]).length, 1);
});
test('responsive sources use actual derivative widths for portrait/panorama and avoid duplicate widths/upscale', () => {
  assert.match(responsiveSources({ id: id(1), width: 2000, height: 4000 }), /tiny 150w.*thumbnail 300w.*medium 800w.*large 1200w/);
  assert.match(responsiveSources({ id: id(1), width: 4000, height: 1000 }), /large 2400w/);
  const small = responsiveSources({ id: id(1), width: 200, height: 100 });
  assert.equal(small.split(',').length, 1); assert.match(small, /200w/); assert.doesNotMatch(small, /source/);
});
test('public image checks real anonymous RLS before touching storage, including parent withdrawal', async () => {
  let reads = 0;
  const dependencies = {
    async visible(photoId: string) { return !!await asRole(db, 'anon', null, async () => (await db.query('select id from public.photos where id=$1', [photoId])).rows[0]); },
    async media() { reads++; return { body: new Response('WEBP BYTES').body!, contentType: 'image/webp' }; },
    missing: () => false,
  };
  for (const number of [4,5,6,7,8,9,999]) assert.equal((await deliverPublicImage(id(number), 'large', dependencies)).status, 404);
  assert.equal(reads, 0);
  for (const variant of publicVariants) {
    const response = await deliverPublicImage(id(1), variant, dependencies);
    assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.match(response.headers.get('cache-control')!, /no-store/); assert.equal(response.headers.get('cdn-cache-control'), 'no-store');
    assert.equal(await response.text(), 'WEBP BYTES');
  }
  await db.exec("update public.locations set status='draft' where slug='published-location'");
  assert.equal((await deliverPublicImage(id(1), 'large', dependencies)).status, 404); assert.equal(reads, 4);
});
test('public image rejects source, source.jpg, unknown variants and malformed IDs without DB or R2 access', async () => {
  const dependencies = { visible: async () => { throw new Error('Must not query'); }, media: async () => { throw new Error('Must not read'); }, missing: () => false };
  for (const variant of ['source', 'source.jpg', 'large.webp', '../source', 'unknown']) assert.equal((await deliverPublicImage(id(1), variant, dependencies)).status, 404);
  assert.equal((await deliverPublicImage('malformed', 'large', dependencies)).status, 404);
});
test('public dependency failures fail closed and never return provider secrets', async () => {
  const response = await deliverPublicImage(id(1), 'large', { visible: async () => { throw new Error('SECRET cloudflarestorage'); }, media: async () => { throw new Error('Should not read'); }, missing: () => false });
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /SECRET|cloudflarestorage/);
  const missing = await deliverPublicImage(id(1), 'large', { visible: async () => true, media: async () => { throw new Error('NoSuchKey'); }, missing: () => true });
  assert.equal(missing.status, 404);
});
