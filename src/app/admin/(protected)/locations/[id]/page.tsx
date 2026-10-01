import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getGeography } from '@/lib/admin/queries';
import { uuidSchema } from '@/lib/validation/content';
import { LocationForm } from '@/components/admin/location-form';
import { DeleteForm } from '@/components/admin/delete-form';
import { deleteLocation } from '../../content-actions';

export default async function LocationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; trip?: string }> }) {
  const { client } = await requireAdmin();
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const [record, geography, associations, photos, query] = await Promise.all([
    client.from('locations').select('*').eq('id', id).maybeSingle(), getGeography(client),
    client.from('trip_locations').select('trip_id').eq('location_id', id),
    client.from('photos').select('id', { count: 'exact', head: true }).eq('location_id', id), searchParams,
  ]);
  if (record.error || associations.error || photos.error) throw new Error('Unable to load Location.');
  if (!record.data) notFound();
  const tripId = query.trip && uuidSchema.safeParse(query.trip).success ? query.trip : undefined;
  const tripIds = associations.data?.map((link) => link.trip_id) ?? [];
  const trips = tripIds.length ? await client.from('trips').select('id,title').in('id', tripIds).order('title') : { data: [], error: null };
  if (trips.error) throw new Error('Unable to load associated Trips.');
  return <main><p><Link href={tripId ? `/admin/trips/${tripId}` : '/admin/locations'}>{tripId ? 'Back to Trip' : 'Locations'}</Link></p><h1>{record.data.name}</h1>
    {query.saved === '1' && <p className="success" role="status">Location created.</p>}
    <LocationForm location={record.data} {...geography} tripId={tripId} />
    <section className="content-section"><h2>Associated Trips</h2>{!trips.data?.length ? <p>No Trips use this Location yet.</p> : <ul>{trips.data.map((trip) => <li key={trip.id}><Link href={`/admin/trips/${trip.id}`}>{trip.title}</Link></li>)}</ul>}</section>
    <DeleteForm action={deleteLocation.bind(null, id)} label="Delete Location" explanation="This permanently deletes the Location. Its City and Country are preserved. Remove Trip associations first; dependent Photos also block deletion." blocked={tripIds.length || (photos.count ?? 0) ? 'This Location is referenced by Trips or Photos. Remove its Trip associations first, or keep it unpublished.' : undefined} />
  </main>;
}
