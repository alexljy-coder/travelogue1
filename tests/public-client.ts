import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { PGlite } from '@electric-sql/pglite';
import type { Database } from '../src/types/database';
import { asRole } from './database';
export function createAnonymousClient(db: PGlite, requests: string[] = []) {
  let pending: Promise<unknown> = Promise.resolve();
  return createClient<Database>('https://fixture.supabase.co', 'anonymous-fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer anonymous-fixture-key');
      const table = url.pathname.split('/').at(-1)!;
      assert.ok(['photos','locations','trips','cities','countries','trip_cities','trip_locations','hotels','stays'].includes(table));
      const rawSelect = url.searchParams.get('select')!;
      const hotelJoin=rawSelect.endsWith(',stays!inner(hotel_id)');
      const singaporePhotoJoin=rawSelect.endsWith(',locations!photos_location_id_fkey!inner(city_id,cities!inner(country_id,countries!inner(code)))');
      const singaporePlaceJoin=rawSelect.endsWith(',cities!inner(country_id,countries!inner(code))');
      const select=hotelJoin?rawSelect.replace(',stays!inner(hotel_id)',''):singaporePhotoJoin?rawSelect.split(',locations!photos_location_id_fkey!inner')[0]:singaporePlaceJoin?rawSelect.split(',cities!inner')[0]:rawSelect;
      assert.ok(/^[a-z_,]+$/.test(select));
      requests.push(`${table}:${select}`);
      const values: string[] = []; const conditions: string[] = [];
      for (const [key, value] of url.searchParams) {
        if (['select','order','limit','offset'].includes(key)) continue;
        if(hotelJoin&&key==='stays.hotel_id'){values.push(value.slice(3));conditions.push(`exists(select 1 from public.stays s where s.id=public.photos.stay_id and s.hotel_id=$${values.length})`);continue;}
        if(singaporePhotoJoin && key==='locations.cities.countries.code') { values.push(value.slice(3));conditions.push(`exists(select 1 from public.locations l join public.cities c on c.id=l.city_id join public.countries k on k.id=c.country_id where l.id=public.photos.location_id and k.code=$${values.length})`);continue; }
        if(singaporePlaceJoin && key==='cities.countries.code') { values.push(value.slice(3));conditions.push(`exists(select 1 from public.cities c join public.countries k on k.id=c.country_id where c.id=public.locations.city_id and k.code=$${values.length})`);continue; }
        assert.ok(/^[a-z_]+$/.test(key));
        if (value.startsWith('eq.')) { values.push(value.slice(3)); conditions.push(`${key}=$${values.length}`); }
        else if (value.startsWith('neq.')) { values.push(value.slice(4)); conditions.push(`${key}<>$${values.length}`); }
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
      const operation = pending.then(() => asRole(db, 'anon', null, async () => (await db.query(sql, values)).rows));
      pending = operation.then(() => undefined, () => undefined);
      const rows = await operation;
      // supabase-js maybeSingle requests an array and normalizes zero/one rows.
      return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } });
    } },
  });
}
