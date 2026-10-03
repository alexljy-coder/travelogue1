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
    const [record, catalog] = await Promise.all([client.from('stays').select('*').eq('id', id).maybeSingle(), getStayCatalog(client)]);
    if (record.error)
        throw new Error('Unable to load Stay.');
    if (!record.data)
        notFound();
    const hotel = catalog.hotels.find(h => h.id === record.data!.hotel_id);
    return <main><Link href="/admin/stays">Stays</Link><h1>Stay at {hotel?.name}</h1><p><Link href={`/admin/hotels/${record.data.hotel_id}`}>Hotel review and photographs</Link> {record.data.trip_id && <> · <Link href={`/admin/trips/${record.data.trip_id}`}>Trip</Link></>}</p><StayForm stay={record.data} {...catalog}/>
 <DeleteForm action={deleteStay.bind(null, id)} label="Delete Stay" explanation="Delete this visit only. Hotel, Trip and Hotel photography are preserved."/></main>;
}
