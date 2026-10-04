import 'server-only';
import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/public';
import { contextualPhotos, locationGeography, locationTrips, publicCover, queryLocation, queryTrip, queryTripIndex, tripGeography, tripPlaces } from './public-places';
export async function publicTrips(page:number) {
  try { return {...await queryTripIndex(createPublicClient(),page), unavailable:false}; }
  catch { return {trips:[],hasNext:false,unavailable:true}; }
}
export const getTrip = cache(async(slug:string)=>queryTrip(createPublicClient(),slug));
export const getLocation = cache(async(slug:string)=>queryLocation(createPublicClient(),slug));
export async function tripPresentation(trip: NonNullable<Awaited<ReturnType<typeof getTrip>>>, pages:{photos:number;record:number;places:number}) {
  const client=createPublicClient();
  const coverPromise=publicCover(client,'trip_id',trip);
  const [cities,places,record,cover]=await Promise.all([
    tripGeography(client,trip.id),tripPlaces(client,trip.id,pages.places),
    contextualPhotos(client,'trip_id',trip.id,'record',pages.record),coverPromise,
  ]);
  const nice=await contextualPhotos(client,'trip_id',trip.id,'nice',pages.photos,cover?.id);
  return {cover,cities,places,nice,record};
}
export async function locationPresentation(location: NonNullable<Awaited<ReturnType<typeof getLocation>>>, pages:{photos:number;trips:number}) {
  const client=createPublicClient();
  const [city,trips,cover]=await Promise.all([
    locationGeography(client,location),locationTrips(client,location.id,pages.trips),
    publicCover(client,'location_id',location),
  ]);
  const nice=await contextualPhotos(client,'location_id',location.id,'nice',pages.photos,cover?.id);
  return {cover,city,trips,nice};
}
