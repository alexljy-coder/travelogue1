import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getStayCatalog } from '@/lib/admin/queries';
import { listPage } from '@/lib/admin/display';
export default async function Page({ searchParams }: {
    searchParams: Promise<{
        page?: string;
        deleted?: string;
    }>;
}) {
    const { client } = await requireAdmin();
    const params = await searchParams;
    const page = listPage(params.page);
    const [result, catalog] = await Promise.all([client.from('stays').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id').range((page - 1) * 25, page * 25 - 1), getStayCatalog(client)]);
    if (result.error || !result.data)
        throw new Error('Unable to load Stays.');
    return <main><div className="page-heading"><h1>Stays</h1><Link href="/admin/stays/new">Create Stay</Link></div>
 {params.deleted === '1' && <p role="status">Stay deleted; related archive records preserved.</p>}
 {!result.data.length ? <p>No Stays on this page. Create your first Stay to begin.</p> : <ul className="record-list">{result.data.map(record => {
                const hotel = catalog.hotels.find(h => h.id === record.hotel_id);
                const trip = catalog.trips.find(t => t.id === record.trip_id);
                return <li key={record.id}><Link href={`/admin/stays/${record.id}`}>{hotel?.name} · {record.check_in ?? 'Date not recorded'}</Link> · {trip?.title} · {record.status}</li>;
            })}</ul>}
 <nav className="pagination" aria-label="Stays pages">{page > 1 && <Link href={`/admin/stays?page=${page - 1}`}>Previous</Link>}{(result.count ?? 0) > page * 25 && <Link href={`/admin/stays?page=${page + 1}`}>Next</Link>}</nav></main>;
}
