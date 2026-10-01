import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getGeography } from '@/lib/admin/queries';
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
    const [result, geography] = await Promise.all([client.from('hotels').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id').range((page - 1) * 25, page * 25 - 1), getGeography(client)]);
    if (result.error || !result.data)
        throw new Error('Unable to load Hotels.');
    return <main><div className="page-heading"><h1>Hotels</h1><Link href="/admin/hotels/new">Create Hotel</Link></div>
 {params.deleted === '1' && <p role="status">Hotel deleted; related archive records preserved.</p>}
 {!result.data.length ? <p>No Hotels on this page. Create your first Hotel to begin.</p> : <ul className="record-list">{result.data.map(record => {
                const city = geography.cities.find(c => c.id === record.city_id);
                return <li key={record.id}><Link href={`/admin/hotels/${record.id}`}>{record.name}</Link> · {city?.name}, {city?.country_name} · {record.status}</li>;
            })}</ul>}
 <nav className="pagination" aria-label="Hotels pages">{page > 1 && <Link href={`/admin/hotels?page=${page - 1}`}>Previous</Link>}{(result.count ?? 0) > page * 25 && <Link href={`/admin/hotels?page=${page + 1}`}>Next</Link>}</nav></main>;
}
