import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { attachContexts, photoProjection, PAGE_SIZE, type PhotoWithContext } from './public-photos';

type Client = SupabaseClient<Database>;
// Geography is ordinary data. These inner joins also retain each parent's anonymous RLS.
export const singaporePhotoProjection = `${photoProjection},locations!photos_location_id_fkey!inner(city_id,cities!inner(country_id,countries!inner(code)))` as const;
export function singaporePhotoQuery(client: Client, classification: 'nice' | 'record') {
  return client.from('photos').select(singaporePhotoProjection)
    .eq('status', 'published').eq('context', 'travel').eq('classification', classification)
    .eq('locations.cities.countries.code', 'SG')
    .order('editorial_order', { nullsFirst: false }).order('captured_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false }).order('id');
}
export async function singaporePhotos(client: Client, classification: 'nice' | 'record', page = 1) {
  const { data, error } = await singaporePhotoQuery(client, classification).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (error) throw new Error('Singapore photography unavailable.');
  const rows = (data ?? []).slice(0, PAGE_SIZE).map(({ locations, ...photo }) => { void locations; return photo; });
  return { photos: await attachContexts(client, rows), hasNext: (data?.length ?? 0) > PAGE_SIZE };
}
export async function singaporeOpening(client: Client, fallback?: PhotoWithContext[]) {
  const { data, error } = await singaporePhotoQuery(client, 'nice').eq('featured', true).limit(1);
  if (error) throw new Error('Singapore photography unavailable.');
  if (data?.length) { const { locations, ...photo } = data[0]; void locations; return (await attachContexts(client, [photo]))[0]; }
  if(fallback) return fallback[0] ?? null;
  const rows=await singaporePhotoQuery(client,'nice').limit(1);
  if(rows.error) throw new Error('Singapore photography unavailable.');
  const photo=rows.data?.[0];
  if(!photo) return null;
  const {locations,...publicPhoto}=photo;void locations;
  return (await attachContexts(client,[publicPhoto]))[0];
}
export async function singaporePlaces(client: Client, page = 1) {
  const { data, error } = await client.from('locations').select('id,name,slug,cities!inner(country_id,countries!inner(code))')
    .eq('status', 'published').eq('cities.countries.code', 'SG')
    .order('editorial_order', { nullsFirst: false }).order('name').order('id')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (error) throw new Error('Singapore Places unavailable.');
  return { places: (data ?? []).slice(0, PAGE_SIZE).map(({ cities, ...place }) => { void cities; return place; }), hasNext: (data?.length ?? 0) > PAGE_SIZE };
}
