import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { uuidSchema } from '@/lib/validation/content';
import { getGeography, getLocations, readAll } from '@/lib/admin/queries';
import { TripForm } from '@/components/admin/trip-form';
import { DeleteForm } from '@/components/admin/delete-form';
import { AddTripCity, AddTripLocation, TripCityRow, TripLocationRow } from '@/components/admin/trip-associations';
import { deleteTrip } from '../../content-actions';

export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; locationAdded?: string }> }) {
  const { client } = await requireAdmin();
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const [{ data: trip, error }, geography, locations, cityLinks, locationLinks, photos, stays, query] = await Promise.all([
    client.from('trips').select('*').eq('id', id).maybeSingle(), getGeography(client), getLocations(client),
    readAll((from, to) => client.from('trip_cities').select('*').eq('trip_id', id).order('sequence', { nullsFirst: false }).order('city_id').range(from, to)),
    readAll((from, to) => client.from('trip_locations').select('*').eq('trip_id', id).order('sequence', { nullsFirst: false }).order('location_id').range(from, to)),
    client.from('photos').select('id', { count: 'exact', head: true }).eq('trip_id', id),
    client.from('stays').select('id', { count: 'exact', head: true }).eq('trip_id', id), searchParams,
  ]);
  if (error || photos.error || stays.error) throw new Error('Unable to load Trip.');
  if (!trip) notFound();
  const citiesById = new Map(geography.cities.map((city) => [city.id, city]));
  const locationsById = new Map(locations.map((location) => [location.id, location]));
  const associated = new Set(locationLinks?.map((link) => link.location_id));
  return <main><p><Link href="/admin/trips">Trips</Link></p><h1>{trip.title}</h1>
    {query.saved === '1' && <p className="success" role="status">Trip created. Add Cities or Locations below.</p>}
    {query.locationAdded === '1' && <p className="success" role="status">Location created and associated. Its City is included too.</p>}
    <TripForm trip={trip} />
    <section className="content-section"><h2>Cities</h2><p>Optional geographic order; this is a record, not a required itinerary.</p>
      {!cityLinks?.length && <p>No Cities associated yet.</p>}
      {cityLinks?.map((link) => { const city = citiesById.get(link.city_id); return city ? <TripCityRow key={city.id} tripId={id} city={city} sequence={link.sequence} /> : null; })}
      <AddTripCity tripId={id} cities={geography.cities} countries={geography.countries} />
    </section>
    <section className="content-section"><h2>Locations</h2>
      {!locationLinks?.length && <p>No Locations associated yet. Add an existing destination or create one.</p>}
      {locationLinks?.map((link) => { const location = locationsById.get(link.location_id); return location ? <TripLocationRow key={location.id} tripId={id} location={location} cityName={citiesById.get(location.city_id)?.name ?? ''} sequence={link.sequence} visitedAt={link.visited_at} /> : null; })}
      <AddTripLocation tripId={id} locations={locations.filter((location) => !associated.has(location.id))} />
    </section>
    <DeleteForm action={deleteTrip.bind(null, id)} label="Delete Trip" explanation={`This permanently deletes this Trip and its ${cityLinks?.length ?? 0} City / ${locationLinks?.length ?? 0} Location associations. Cities and Locations are kept. Photos or Stays block deletion.`} blocked={(photos.count ?? 0) || (stays.count ?? 0) ? 'This Trip has Photos or Stays. Keep it, or change its status to Draft.' : undefined} />
  </main>;
}
