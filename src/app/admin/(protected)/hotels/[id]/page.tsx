import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getGeography } from '@/lib/admin/queries';
import { uuidSchema } from '@/lib/validation/content';
import { HotelForm } from '@/components/admin/hotel-form';
import { DeleteForm } from '@/components/admin/delete-form';
import { deleteHotel } from '../../stay-actions';
export default async function Page({ params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { client } = await requireAdmin();
    const { id } = await params;
    if (!uuidSchema.safeParse(id).success)
        notFound();
    const [record, geography, stays] = await Promise.all([client.from('hotels').select('*').eq('id', id).maybeSingle(), getGeography(client), client.from('stays').select('id,check_in,status', { count: 'exact' }).eq('hotel_id', id).order('check_in', { ascending: false, nullsFirst: false }).order('id').limit(25)]);
    if (record.error || stays.error)
        throw new Error('Unable to load Hotel.');
    if (!record.data)
        notFound();
    return <main><Link href="/admin/hotels">Hotels</Link><h1>{record.data.name}</h1><HotelForm hotel={record.data} {...geography}/>
 <section className="content-section"><h2>Stays</h2><Link href={`/admin/stays/new?hotel=${id}`}>Add Stay</Link>{!stays.data?.length ? <p>No Stays yet.</p> : <ul>{stays.data.map(s => <li key={s.id}><Link href={`/admin/stays/${s.id}`}>{s.check_in ?? 'Undated Stay'}</Link> · {s.status}</li>)}</ul>}{(stays.count ?? 0) > 25 && <p>Showing 25 Stays. <Link href="/admin/stays">All Stays</Link></p>}</section>
 <DeleteForm action={deleteHotel.bind(null, id)} label="Delete Hotel" explanation="Delete only an unreferenced Hotel. Stays block deletion; no archive data is cascaded." blocked={(stays.count ?? 0) > 0 ? 'This Hotel has Stays. Keep it or unpublish it instead.' : undefined}/></main>;
}
