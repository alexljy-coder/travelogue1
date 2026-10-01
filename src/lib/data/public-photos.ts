import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
// Narrower than anonymous grants; never SELECT * or private metadata.
export const photoProjection = 'id,width,height,classification,context,featured,caption,description,editorial_order,captured_at,camera_make,camera_model,lens,focal_length,aperture,shutter_speed,iso,created_at,location_id,trip_id' as const;
type Row = Database['public']['Tables']['photos']['Row'];
export type PublicPhoto = Pick<Row, 'id' | 'width' | 'height' | 'classification' | 'context' | 'featured' | 'caption' | 'description' | 'editorial_order' | 'captured_at' | 'camera_make' | 'camera_model' | 'lens' | 'focal_length' | 'aperture' | 'shutter_speed' | 'iso' | 'created_at' | 'location_id' | 'trip_id'>;
export type PhotoWithContext = PublicPhoto & { place: { location: string | null; city: string | null; country: string | null; trip: string | null } };
export const PAGE_SIZE = 24;
export const isPhotoId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function orderedPhotos(client: SupabaseClient<Database>) {
  return client.from('photos').select(photoProjection).eq('status', 'published')
    .order('editorial_order', { ascending: true, nullsFirst: false })
    .order('captured_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false }).order('id', { ascending: true });
}
export function selectHomepagePhotos(featured: PublicPhoto[], recent: PublicPhoto[], limit = 9) {
  const seen = new Set<string>();
  return [...featured.filter((p) => p.featured), ...recent].filter((p) => {
    if (p.classification !== 'nice' || seen.has(p.id)) return false;
    seen.add(p.id); return true;
  }).slice(0, limit);
}
// Related reads retain anonymous RLS. No Stay/review/private-note projection.
export async function attachContexts(client: SupabaseClient<Database>, photos: PublicPhoto[]): Promise<PhotoWithContext[]> {
  if (!photos.length) return [];
  const locationIds = [...new Set(photos.flatMap((p) => p.location_id ? [p.location_id] : []))];
  const tripIds = [...new Set(photos.flatMap((p) => p.trip_id ? [p.trip_id] : []))];
  const [locations, trips] = await Promise.all([
    locationIds.length ? client.from('locations').select('id,name,city_id').in('id', locationIds) : Promise.resolve({ data: [], error: null }),
    tripIds.length ? client.from('trips').select('id,title').in('id', tripIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (locations.error || trips.error) throw new Error('Public context unavailable.');
  const cityIds = [...new Set((locations.data ?? []).map((l) => l.city_id))];
  const cities = cityIds.length ? await client.from('cities').select('id,name,country_id').in('id', cityIds) : { data: [], error: null };
  if (cities.error) throw new Error('Public geography unavailable.');
  const countryIds = [...new Set((cities.data ?? []).map((c) => c.country_id))];
  const countries = countryIds.length ? await client.from('countries').select('id,name').in('id', countryIds) : { data: [], error: null };
  if (countries.error) throw new Error('Public geography unavailable.');
  return photos.map((photo) => {
    const location = locations.data?.find((l) => l.id === photo.location_id);
    const city = cities.data?.find((c) => c.id === location?.city_id);
    const country = countries.data?.find((c) => c.id === city?.country_id);
    return { ...photo, place: { location: location?.name ?? null, city: city?.name ?? null, country: country?.name ?? null, trip: trips.data?.find((t) => t.id === photo.trip_id)?.title ?? null } };
  });
}
export async function queryPhoto(client: SupabaseClient<Database>, id: string) {
  if (!isPhotoId(id)) return null;
  const { data, error } = await client.from('photos').select(photoProjection).eq('status', 'published').eq('id', id).maybeSingle();
  if (error) throw new Error('Public photo unavailable.');
  return data ? (await attachContexts(client, [data]))[0] : null;
}
