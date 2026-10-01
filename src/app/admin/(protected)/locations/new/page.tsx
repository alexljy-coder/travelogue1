import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getGeography } from '@/lib/admin/queries';
import { uuidSchema } from '@/lib/validation/content';
import { LocationForm } from '@/components/admin/location-form';

export default async function NewLocationPage({ searchParams }: { searchParams: Promise<{ trip?: string }> }) {
  const { client } = await requireAdmin();
  const { trip } = await searchParams;
  if (trip) {
    if (!uuidSchema.safeParse(trip).success) notFound();
    const result = await client.from('trips').select('id').eq('id', trip).maybeSingle();
    if (result.error) throw new Error('Unable to load Trip.');
    if (!result.data) notFound();
  }
  const geography = await getGeography(client);
  return <main><p><Link href={trip ? `/admin/trips/${trip}` : '/admin/locations'}>{trip ? 'Back to Trip' : 'Locations'}</Link></p><h1>Create Location</h1>{trip && <p>This Location will be added to the Trip when saved.</p>}<LocationForm {...geography} tripId={trip} /></main>;
}
