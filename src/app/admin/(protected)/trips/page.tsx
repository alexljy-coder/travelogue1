import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listPage, tripDates } from '@/lib/admin/display';

export default async function TripsPage({ searchParams }: { searchParams: Promise<{ page?: string; deleted?: string }> }) {
  const { client } = await requireAdmin();
  const params = await searchParams;
  const page = listPage(params.page);
  const { data: trips, count, error } = await client.from('trips').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id').range((page - 1) * 25, page * 25 - 1);
  if (error || !trips) throw new Error('Unable to load Trips.');
  return <main><div className="page-heading"><h1>Trips</h1><Link href="/admin/trips/new">Create Trip</Link></div>
    {params.deleted === '1' && <p className="success" role="status">Trip deleted. Geographic records were preserved.</p>}
    {!trips.length ? <p>{page === 1 ? 'No Trips yet. Create your first Trip; dates can remain unknown.' : 'No Trips on this page.'}</p> : <div className="table-wrap"><table><thead><tr><th scope="col">Trip</th><th scope="col">Dates</th><th scope="col">Status</th></tr></thead><tbody>{trips.map((trip) => <tr key={trip.id}><td><Link href={`/admin/trips/${trip.id}`}>{trip.title}</Link></td><td>{tripDates(trip.start_date, trip.end_date)}</td><td>{trip.status === 'published' ? 'Published' : 'Draft'}</td></tr>)}</tbody></table></div>}
    <nav className="pagination" aria-label="Trip list pages">{page > 1 && <Link href={`/admin/trips?page=${page - 1}`}>Previous</Link>}{(count ?? 0) > page * 25 && <Link href={`/admin/trips?page=${page + 1}`}>Next</Link>}</nav>
  </main>;
}
