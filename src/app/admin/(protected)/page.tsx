import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';

export default async function AdminPage() {
  const { client } = await requireAdmin();
  const [trips, locations] = await Promise.all([
    client.from('trips').select('id', { count: 'exact', head: true }),
    client.from('locations').select('id', { count: 'exact', head: true }),
  ]);
  if (trips.error || locations.error) throw new Error('Unable to load the archive.');
  return <main><h1>Your travel archive</h1><p>Start with a Trip, then connect the places you visited.</p>
    <div className="dashboard-links"><section className="panel"><h2>Trips</h2><p>{trips.count ?? 0} recorded</p><p><Link href="/admin/trips">View Trips</Link></p><Link href="/admin/trips/new">Create a Trip</Link></section><section className="panel"><h2>Locations</h2><p>{locations.count ?? 0} recorded</p><p><Link href="/admin/locations">View Locations</Link></p><Link href="/admin/locations/new">Create a Location</Link></section></div>
    <p>Historical dates can stay unknown. Locations remain independently editable and can belong to more than one Trip.</p>
  </main>;
}
