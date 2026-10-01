import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getGeography } from '@/lib/admin/queries';
import { listPage } from '@/lib/admin/display';

export default async function LocationsPage({ searchParams }: { searchParams: Promise<{ page?: string; deleted?: string }> }) {
  const { client } = await requireAdmin();
  const params = await searchParams;
  const page = listPage(params.page);
  const [result, geography] = await Promise.all([
    client.from('locations').select('*', { count: 'exact' }).order('name').order('id').range((page - 1) * 25, page * 25 - 1), getGeography(client),
  ]);
  if (result.error || !result.data) throw new Error('Unable to load Locations.');
  const cities = new Map(geography.cities.map((city) => [city.id, city]));
  return <main><div className="page-heading"><h1>Locations</h1><Link href="/admin/locations/new">Create Location</Link></div>
    <p>Meaningful destinations you visited or photographed. Hotels are recorded separately.</p>
    {params.deleted === '1' && <p className="success" role="status">Location deleted. City and Country records were preserved.</p>}
    {!result.data.length ? <p>{page === 1 ? 'No Locations yet. Create a destination and select or create its City.' : 'No Locations on this page.'}</p> : <div className="table-wrap"><table><thead><tr><th scope="col">Location</th><th scope="col">City / Country</th><th scope="col">Status</th></tr></thead><tbody>{result.data.map((location) => { const city = cities.get(location.city_id); return <tr key={location.id}><td><Link href={`/admin/locations/${location.id}`}>{location.name}</Link></td><td>{city?.name} · {city?.country_name}</td><td>{location.status === 'published' ? 'Published' : 'Draft'}</td></tr>; })}</tbody></table></div>}
    <nav className="pagination" aria-label="Location list pages">{page > 1 && <Link href={`/admin/locations?page=${page - 1}`}>Previous</Link>}{(result.count ?? 0) > page * 25 && <Link href={`/admin/locations?page=${page + 1}`}>Next</Link>}</nav>
  </main>;
}
