import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { attachContexts, orderedPhotos, PAGE_SIZE, isPhotoId, photoProjection } from './public-photos';
import { geography, tripProjection, validSlug } from './public-places';

type Client = SupabaseClient<Database>;
export const hotelProjection = 'id,name,slug,brand,city_id,address,description,rating,recommended_family,recommended_business,recommended_leisure' as const;
export const stayProjection = 'id,hotel_id,trip_id,check_in,check_out,room_type,purpose,rating,review_text' as const;
export type PublicHotel = Pick<Database['public']['Tables']['hotels']['Row'], 'id' | 'name' | 'slug' | 'brand' | 'city_id' | 'address' | 'description' | 'rating' | 'recommended_family' | 'recommended_business' | 'recommended_leisure'>;
export type PublicStay = Pick<Database['public']['Tables']['stays']['Row'], 'id' | 'hotel_id' | 'trip_id' | 'check_in' | 'check_out' | 'room_type' | 'purpose' | 'rating' | 'review_text'>;

function checked<T>(result: { data: T | null; error: unknown }): T {
  if (result.error || result.data === null) throw new Error('Public Stays unavailable.');
  return result.data;
}
export function recommendations(hotel: Pick<PublicHotel, 'recommended_family' | 'recommended_business' | 'recommended_leisure'>) {
  return [hotel.recommended_family ? 'Family' : null, hotel.recommended_business ? 'Business' : null, hotel.recommended_leisure ? 'Personal / Leisure' : null].filter((value): value is string => !!value);
}
export async function queryHotel(client: Client, slug: string) {
  if (!validSlug(slug)) return null;
  const result = await client.from('hotels').select(hotelProjection).eq('status', 'published').eq('slug', slug).maybeSingle();
  if (result.error) throw new Error('Public Hotel unavailable.');
  return result.data;
}
export async function queryStay(client: Client, hotelId: string, id: string) {
  if (!isPhotoId(id)) return null;
  const result = await client.from('stays').select(stayProjection).eq('status', 'published').eq('hotel_id', hotelId).eq('id', id).maybeSingle();
  if (result.error) throw new Error('Public Stay unavailable.');
  return result.data;
}
export function orderedStays(client: Client) {
  return client.from('stays').select(stayProjection).eq('status', 'published')
    .order('editorial_order', { nullsFirst: false }).order('check_in', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false }).order('id');
}
export async function relatedStays(client: Client, key: 'hotel_id' | 'trip_id', id: string, page = 1) {
  const rows = checked(await orderedStays(client).eq(key, id).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
  const stays = rows.slice(0, PAGE_SIZE);
  const [hotels, trips] = await Promise.all([
    stays.length ? client.from('hotels').select('id,name,slug').in('id', [...new Set(stays.map(stay => stay.hotel_id))]) : { data: [], error: null },
    stays.length ? client.from('trips').select('id,title,slug').in('id', [...new Set(stays.map(stay => stay.trip_id))]) : { data: [], error: null },
  ]);
  const hotelRows = checked(hotels), tripRows = checked(trips);
  return {
    stays: stays.map(stay => ({ ...stay, hotel: hotelRows.find(hotel => hotel.id === stay.hotel_id) ?? null, trip: tripRows.find(trip => trip.id === stay.trip_id) ?? null })),
    hasNext: rows.length > PAGE_SIZE,
  };
}
export async function stayPhotos(client: Client, id: string, classification: 'nice' | 'record', page = 1, exclude?: string) {
  let query = orderedPhotos(client).eq('context', 'hotel').eq('stay_id', id).eq('classification', classification);
  if (exclude) query = query.neq('id', exclude);
  const rows = checked(await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
  return { photos: await attachContexts(client, rows.slice(0, PAGE_SIZE)), hasNext: rows.length > PAGE_SIZE };
}
// The existing FK lets PostgREST join Stay under anonymous RLS; no unbounded Stay-ID list.
function orderedHotelPhotos(client: Client, hotelId: string) {
  return client.from('photos').select(`${photoProjection},stays!inner(hotel_id)`)
    .eq('status', 'published').eq('context', 'hotel').eq('classification', 'nice').eq('stays.hotel_id', hotelId)
    .order('editorial_order', { nullsFirst: false }).order('captured_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false }).order('id');
}
export async function hotelPhotos(client: Client, hotelId: string, page = 1, exclude?: string) {
  let query = orderedHotelPhotos(client, hotelId);
  if (exclude) query = query.neq('id', exclude);
  const rows = checked(await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
  const photos = rows.slice(0, PAGE_SIZE).map(({ stays, ...photo }) => { void stays; return photo; });
  return { photos: await attachContexts(client, photos), hasNext: rows.length > PAGE_SIZE };
}
export async function stayCover(client: Client, id: string) {
  const rows = checked(await orderedPhotos(client).eq('context', 'hotel').eq('stay_id', id).eq('classification', 'nice').limit(1));
  return rows.length ? (await attachContexts(client, rows))[0] : null;
}
async function hotelCoverCandidate(client: Client, id: string) {
  const rows = checked(await orderedHotelPhotos(client, id).limit(1));
  if (!rows.length) return null;
  const { stays, ...photo } = rows[0];
  void stays;
  return photo;
}
export async function hotelCover(client: Client, id: string) {
  const photo = await hotelCoverCandidate(client, id);
  return photo ? (await attachContexts(client, [photo]))[0] : null;
}
export async function queryHotelIndex(client: Client, page = 1) {
  const rows = checked(await client.from('hotels').select(hotelProjection).eq('status', 'published')
    .order('editorial_order', { nullsFirst: false }).order('name').order('id').range((page - 1) * 12, page * 12));
  const selected = rows.slice(0, 12);
  const cities = await geography(client, selected.map(hotel => hotel.city_id));
  const candidates: Awaited<ReturnType<typeof hotelCoverCandidate>>[] = [];
  for (let index = 0; index < selected.length; index += 3) {
    candidates.push(...await Promise.all(selected.slice(index, index + 3).map(hotel => hotelCoverCandidate(client, hotel.id))));
  }
  const covers = await attachContexts(client, candidates.filter(photo => photo !== null));
  const hotels = selected.map((hotel, index) => ({ ...hotel, city: cities.find(city => city.id === hotel.city_id) ?? null, cover: covers.find(photo => photo.id === candidates[index]?.id) ?? null }));
  return { hotels, hasNext: rows.length > 12 };
}
export async function hotelPresentation(client: Client, hotel: PublicHotel, pages: { stays: number; photos: number }) {
  const cover = await hotelCover(client, hotel.id);
  const [cities, stays, nice] = await Promise.all([
    geography(client, [hotel.city_id]), relatedStays(client, 'hotel_id', hotel.id, pages.stays), hotelPhotos(client, hotel.id, pages.photos, cover?.id),
  ]);
  return { cover, city: cities[0] ?? null, stays, nice };
}
export async function stayPresentation(client: Client, stay: PublicStay, pages: { photos: number; record: number }) {
  const cover = await stayCover(client, stay.id);
  const [nice, record, trip] = await Promise.all([
    stayPhotos(client, stay.id, 'nice', pages.photos, cover?.id), stayPhotos(client, stay.id, 'record', pages.record),
    client.from('trips').select(tripProjection).eq('id', stay.trip_id).maybeSingle(),
  ]);
  if (trip.error) throw new Error('Public Stay context unavailable.');
  return { cover, nice, record, trip: trip.data };
}
