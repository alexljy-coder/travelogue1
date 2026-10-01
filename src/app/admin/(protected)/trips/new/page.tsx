import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { TripForm } from '@/components/admin/trip-form';

export default async function NewTripPage() {
  await requireAdmin();
  return <main><p><Link href="/admin/trips">Trips</Link></p><h1>Create Trip</h1><p>Save the Trip first, then add Cities and Locations.</p><TripForm /></main>;
}
