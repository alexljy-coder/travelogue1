import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getStayCatalog } from '@/lib/admin/queries';
import { uuidSchema } from '@/lib/validation/content';
import { StayForm } from '@/components/admin/stay-form';
import { DeleteForm } from '@/components/admin/delete-form';
import { deleteStay } from '../../stay-actions';
export default async function Page({ params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { client } = await requireAdmin();
    const { id } = await params;
    if (!uuidSchema.safeParse(id).success)
        notFound();
    const [record, catalog, photos, imports] = await Promise.all([client.from('stays').select('*').eq('id', id).maybeSingle(), getStayCatalog(client), client.from('photos').select('id,filename', { count: 'exact' }).eq('stay_id', id).order('id').limit(25), client.from('import_items').select('id', { count: 'exact', head: true }).eq('stay_id', id)]);
    if (record.error || photos.error || imports.error)
        throw new Error('Unable to load Stay.');
    if (!record.data)
        notFound();
    const hotel = catalog.hotels.find(h => h.id === record.data!.hotel_id);
    return <main><Link href="/admin/stays">Stays</Link><h1>Stay at {hotel?.name}</h1><p><Link href={`/admin/hotels/${record.data.hotel_id}`}>Hotel and recommendations</Link> · <Link href={`/admin/trips/${record.data.trip_id}`}>Trip</Link></p><StayForm stay={record.data} {...catalog}/>
 <section className="content-section"><h2>Hotel photography</h2><Link href={`/admin/photos/import?stay=${id}`}>Import Hotel photos for this Stay</Link><p>Assign existing photos in <Link href="/admin/photos">Photos</Link>.</p><ul>{photos.data?.map(p => <li key={p.id}><Link href={`/admin/photos/${p.id}`}>{p.filename}</Link></li>)}</ul>{(photos.count ?? 0) > 25 && <p>Showing 25 photos. More are available in Photos.</p>}</section>
 <DeleteForm action={deleteStay.bind(null, id)} label="Delete Stay" explanation="Hotel, Trip and Cities are preserved. Photos and pending import assignments block deletion. Delete photos through the storage-aware Photo workflow first." blocked={(photos.count ?? 0) + (imports.count ?? 0) > 0 ? 'This Stay has Photos or import references. Resolve those before deletion, or keep it unpublished.' : undefined}/></main>;
}
