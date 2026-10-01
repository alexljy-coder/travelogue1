import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { CityOption } from './catalog';

export type AdminClient = SupabaseClient<Database>;

// PostgREST limits each response. Read catalogs in bounded pages so selectors never silently truncate.
export async function readAll<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; ; from += 500) {
    const page = await load(from, from + 499);
    if (page.error || !page.data) throw new Error('Unable to load archive records. Please reload.');
    result.push(...page.data);
    if (page.data.length < 500) return result;
  }
}
export async function getGeography(client: AdminClient) {
  const [countries, cities] = await Promise.all([
    readAll((from, to) => client.from('countries').select('*').order('name').order('id').range(from, to)),
    readAll((from, to) => client.from('cities').select('*').order('name').order('id').range(from, to)),
  ]);
  const names = new Map(countries.map((country) => [country.id, country.name]));
  const options: CityOption[] = cities.map((city) => ({ ...city, country_name: names.get(city.country_id) ?? '' }));
  return { countries, cities: options };
}
export async function getLocations(client: AdminClient) {
  return readAll((from, to) => client.from('locations').select('*').order('name').order('id').range(from, to));
}
