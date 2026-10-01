import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { attachContexts, orderedPhotos, PAGE_SIZE, type PhotoWithContext, type PublicPhoto } from './public-photos';
type Client = SupabaseClient<Database>;
export const tripProjection = 'id,title,slug,start_date,end_date,description,cover_photo_id,editorial_order,created_at' as const;
export const locationProjection = 'id,name,slug,city_id,description,cover_photo_id' as const;
type TripRow = Database['public']['Tables']['trips']['Row'];
type LocationRow = Database['public']['Tables']['locations']['Row'];
export type PublicTrip = Pick<TripRow, 'id'|'title'|'slug'|'start_date'|'end_date'|'description'|'cover_photo_id'|'editorial_order'|'created_at'>;
export type PublicLocation = Pick<LocationRow, 'id'|'name'|'slug'|'city_id'|'description'|'cover_photo_id'>;
export type Geography = { id: string; name: string; country: string | null };
export const TRIP_PAGE_SIZE = 12;
export const validSlug = (slug: string) => slug.length <= 200 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
export function pageNumber(value?: string) { const n = Number(value ?? 1); return Number.isSafeInteger(n) && n > 0 && n <= 100000 ? n : 1; }
export function tripDates(trip: Pick<PublicTrip, 'start_date'|'end_date'>) {
  const format = (value: string) => new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(value.slice(0,10) + 'T00:00:00Z'));
  if (trip.start_date && trip.end_date) return trip.start_date === trip.end_date ? format(trip.start_date) : `${format(trip.start_date)} – ${format(trip.end_date)}`;
  return trip.start_date ? `From ${format(trip.start_date)}` : trip.end_date ? `Until ${format(trip.end_date)}` : null;
}
function checked<T>(result: { data: T | null; error: unknown }): T {
  if (result.error || result.data === null) throw new Error('Public archive unavailable.');
  return result.data;
}
async function geography(client: Client, cityIds: string[]): Promise<Geography[]> {
  const cities: {id:string;name:string;country_id:string}[] = [];
  const countries: {id:string;name:string}[] = [];
  const ids = [...new Set(cityIds)];
  for (let i=0; i<ids.length; i+=100) cities.push(...checked(await client.from('cities').select('id,name,country_id').in('id',ids.slice(i,i+100))));
  const countryIds = [...new Set(cities.map(c=>c.country_id))];
  for (let i=0; i<countryIds.length; i+=100) countries.push(...checked(await client.from('countries').select('id,name').in('id',countryIds.slice(i,i+100))));
  return ids.flatMap(id => { const city = cities.find(c=>c.id===id); return city ? [{ id, name:city.name, country:countries.find(c=>c.id===city.country_id)?.name ?? null }] : []; });
}
export async function tripGeography(client: Client, tripId: string) {
  const ids: string[] = [];
  // Supporting geography is read in bounded chunks, not silently truncated at PostgREST's row cap.
  for (let offset=0; ; offset+=200) {
    const rows = checked(await client.from('trip_cities').select('city_id,sequence').eq('trip_id',tripId).order('sequence',{nullsFirst:false}).order('city_id').range(offset,offset+199));
    ids.push(...rows.map(r=>r.city_id)); if(rows.length<200) break;
  }
  return geography(client, ids);
}
export async function queryTrip(client: Client, slug: string) {
  if (!validSlug(slug)) return null;
  const result = await client.from('trips').select(tripProjection).eq('status','published').eq('slug',slug).maybeSingle();
  if(result.error) throw new Error('Public Trip unavailable.');
  return result.data;
}
export async function queryLocation(client: Client, slug: string) {
  if (!validSlug(slug)) return null;
  const result = await client.from('locations').select(locationProjection).eq('status','published').eq('slug',slug).maybeSingle();
  if(result.error) throw new Error('Public place unavailable.');
  return result.data;
}
export async function contextualPhotos(client: Client, key: 'trip_id'|'location_id', id: string, classification: 'nice'|'record', page=1, exclude?: string) {
  let query = orderedPhotos(client).eq('context','travel').eq(key,id).eq('classification',classification);
  if(exclude) query = query.neq('id',exclude);
  const offset=(page-1)*PAGE_SIZE;
  const rows = checked(await query.range(offset,offset+PAGE_SIZE));
  return { photos:await attachContexts(client,rows.slice(0,PAGE_SIZE)), hasNext:rows.length>PAGE_SIZE };
}
async function coverCandidate(client: Client, key: 'trip_id'|'location_id', parent: { id:string; cover_photo_id:string|null }): Promise<PublicPhoto|null> {
  if(parent.cover_photo_id) {
    const rows = checked(await orderedPhotos(client).eq('context','travel').eq('classification','nice').eq(key,parent.id).eq('id',parent.cover_photo_id).limit(1));
    if(rows.length) return rows[0];
  }
  const rows = checked(await orderedPhotos(client).eq('context','travel').eq('classification','nice').eq(key,parent.id).limit(1));
  return rows[0] ?? null;
}
export async function publicCover(client: Client, key: 'trip_id'|'location_id', parent: { id:string; cover_photo_id:string|null }): Promise<PhotoWithContext|null> {
  const photo=await coverCandidate(client,key,parent);
  return photo ? (await attachContexts(client,[photo]))[0] : null;
}
export async function queryTripIndex(client: Client, page=1) {
  const offset=(page-1)*TRIP_PAGE_SIZE;
  const rows = checked(await client.from('trips').select(tripProjection).eq('status','published').order('editorial_order',{nullsFirst:false}).order('start_date',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).order('id').range(offset,offset+TRIP_PAGE_SIZE));
  const selected=rows.slice(0,TRIP_PAGE_SIZE);
  if(!selected.length) return {trips:[],hasNext:false};
  const joins: {trip_id:string;city_id:string;sequence:number|null}[]=[];
  for(let offset=0;;offset+=200){
    const chunk=checked(await client.from('trip_cities').select('trip_id,city_id,sequence').in('trip_id',selected.map(t=>t.id)).order('sequence',{nullsFirst:false}).order('trip_id').order('city_id').range(offset,offset+199));
    joins.push(...chunk);if(chunk.length<200)break;
  }
  const cities=await geography(client,joins.map(j=>j.city_id));
  const candidates: (PublicPhoto|null)[]=[];
  // At most three simultaneous cover lookups; never read every Trip photograph.
  for(let i=0;i<selected.length;i+=3) candidates.push(...await Promise.all(selected.slice(i,i+3).map(t=>coverCandidate(client,'trip_id',t))));
  const covers=await attachContexts(client,candidates.filter((p):p is PublicPhoto=>!!p));
  const trips=selected.map((trip,index)=>({...trip,cities:joins.filter(j=>j.trip_id===trip.id).flatMap(j=>cities.filter(c=>c.id===j.city_id)),cover:covers.find(p=>p.id===candidates[index]?.id)??null}));
  return {trips,hasNext:rows.length>TRIP_PAGE_SIZE};
}
export async function tripPlaces(client: Client, tripId: string, page=1) {
  const offset=(page-1)*PAGE_SIZE;
  const joins=checked(await client.from('trip_locations').select('location_id,sequence').eq('trip_id',tripId).order('sequence',{nullsFirst:false}).order('location_id').range(offset,offset+PAGE_SIZE));
  const ids=joins.slice(0,PAGE_SIZE).map(j=>j.location_id);
  const locations=ids.length ? checked(await client.from('locations').select(locationProjection).in('id',ids)) : [];
  const cities=await geography(client,locations.map(l=>l.city_id));
  return { places:ids.flatMap(id=>{const location=locations.find(l=>l.id===id);return location ? [{...location,city:cities.find(c=>c.id===location.city_id)??null}] : [];}), hasNext:joins.length>PAGE_SIZE };
}
export async function locationGeography(client: Client, location: PublicLocation) { return (await geography(client,[location.city_id]))[0]??null; }
export async function locationTrips(client: Client, locationId: string, page=1) {
  const offset=(page-1)*PAGE_SIZE;
  const joins=checked(await client.from('trip_locations').select('trip_id').eq('location_id',locationId).order('trip_id').range(offset,offset+PAGE_SIZE));
  const ids=joins.slice(0,PAGE_SIZE).map(j=>j.trip_id);
  const trips=ids.length ? checked(await client.from('trips').select(tripProjection).in('id',ids)) : [];
  return { trips:ids.flatMap(id=>trips.filter(t=>t.id===id)),hasNext:joins.length>PAGE_SIZE };
}
