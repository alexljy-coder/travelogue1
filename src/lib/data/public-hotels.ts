import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { attachContexts, orderedPhotos, PAGE_SIZE, indexCovers } from './public-photos';
import { geography, validSlug } from './public-places';

type Client = SupabaseClient<Database>;
export const hotelProjection = 'id,name,slug,brand,city_id,address,description,review_text,cover_photo_id,rating,recommended_family,recommended_business,recommended_leisure' as const;
export const hotelSummaryProjection='id,name,slug,brand,city_id,rating,recommended_family,recommended_business,recommended_leisure,cover_photo_id' as const;
export type PublicHotel = Pick<Database['public']['Tables']['hotels']['Row'], 'id' | 'name' | 'slug' | 'brand' | 'city_id' | 'address' | 'description' | 'review_text' | 'cover_photo_id' | 'rating' | 'recommended_family' | 'recommended_business' | 'recommended_leisure'>;

function checked<T>(result: { data: T | null; error: unknown }): T {
  if (result.error || result.data === null) throw new Error('Public Hotels unavailable.');
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
export async function hotelPhotos(client: Client, hotelId: string, page = 1, exclude?: string, classification: 'nice' | 'record' = 'nice') {
  let query=orderedPhotos(client).eq('context','hotel').eq('hotel_id',hotelId).eq('classification',classification);
  if(exclude) query=query.neq('id',exclude);
  const rows=checked(await query.range((page-1)*PAGE_SIZE,page*PAGE_SIZE));
  return {photos:await attachContexts(client,rows.slice(0,PAGE_SIZE)),hasNext:rows.length>PAGE_SIZE};
}
export async function hotelCover(client: Client, id: string, coverId?: string | null) {
  if(coverId === undefined) {
    const result=await client.from('hotels').select('cover_photo_id').eq('id',id).maybeSingle();
    if(result.error) throw new Error('Hotel cover unavailable.');
    coverId=result.data?.cover_photo_id;
  }
  if(coverId) {
    const rows=checked(await orderedPhotos(client).eq('id',coverId).eq('hotel_id',id).eq('context','hotel').eq('classification','nice').limit(1));
    if(rows.length) return (await attachContexts(client,rows))[0];
  }
  const rows=checked(await orderedPhotos(client).eq('hotel_id',id).eq('context','hotel').eq('classification','nice').limit(1));
  return rows.length ? (await attachContexts(client,rows))[0] : null;
}
export async function queryHotelIndex(client: Client, page = 1) {
  const rows=checked(await client.from('hotels').select(hotelSummaryProjection).eq('status','published')
    .order('editorial_order',{nullsFirst:false}).order('name').order('id').range((page-1)*12,page*12));
  const selected=rows.slice(0,12);
  const [cities,covers]=await Promise.all([geography(client,selected.map(h=>h.city_id)),indexCovers(client,selected.map(h=>h.id),'hotel')]);
  return {hotels:selected.map(hotel=>({...hotel,city:cities.find(c=>c.id===hotel.city_id)??null,cover:covers.find(c=>c.parent_id===hotel.id)?.cover??null})),hasNext:rows.length>12};
}
export async function hotelPresentation(client: Client, hotel: PublicHotel, pages: { photos: number; record?: number }) {
  // Start independent geography/Record reads before the cover→Nice pagination dependency.
  const [cities,record,cover]=await Promise.all([
    geography(client,[hotel.city_id]),
    hotelPhotos(client,hotel.id,pages.record??1,undefined,'record'),hotelCover(client,hotel.id,hotel.cover_photo_id),
  ]);
  const nice=await hotelPhotos(client,hotel.id,pages.photos,cover?.id);
  return {cover,city:cities[0]??null,nice,record};
}
