import Link from 'next/link';
import Image from 'next/image';
import {readAll} from '@/lib/admin/queries';
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
    const [record, geography, stays, photos, imports, covers] = await Promise.all([client.from('hotels').select('*').eq('id', id).maybeSingle(), getGeography(client), client.from('stays').select('id,check_in,status', { count: 'exact' }).eq('hotel_id', id).order('check_in', { ascending: false, nullsFirst: false }).order('id').limit(25),
 client.from('photos').select('id,filename,caption,width,height,processing_status,status,classification,featured',{count:'exact'}).eq('hotel_id',id).order('created_at',{ascending:false}).order('id').limit(25),
 client.from('import_items').select('id',{count:'exact',head:true}).eq('hotel_id',id),
 readAll((from,to)=>client.from('photos').select('id,filename,caption').eq('hotel_id',id).eq('context','hotel').eq('status','published').eq('classification','nice').eq('processing_status','ready').order('created_at',{ascending:false}).order('id').range(from,to))]);
    if (record.error || stays.error || photos.error || imports.error)
        throw new Error('Unable to load Hotel.');
    if (!record.data)
        notFound();
    return <main><Link href="/admin/hotels">Hotels</Link><h1>{record.data.name}</h1><HotelForm hotel={record.data} {...geography} covers={covers}/>
 <section className="content-section"><h2>Photos</h2><Link href={`/admin/photos/import?hotel=${id}`}>Import Hotel photos</Link><p>Open a photo to edit classification, publication or Featured.</p><div className="admin-photo-grid">{photos.data?.map(photo=><article key={photo.id}><Link href={`/admin/photos/${photo.id}`}>{photo.processing_status==='ready' && <Image unoptimized src={`/admin/photos/${photo.id}/image/thumbnail`} width={photo.width} height={photo.height} alt={photo.caption || photo.filename}/>}<p>{photo.filename} · {photo.classification} · {photo.status}{photo.featured?' · Featured':''}</p></Link></article>)}</div>{!photos.data?.length && <p>No Hotel photographs yet.</p>}{(photos.count??0)>25 && <Link href="/admin/photos">More photos</Link>}</section>
 <section className="content-section"><h2>Stays</h2><Link href={`/admin/stays/new?hotel=${id}`}>Add Stay</Link>{!stays.data?.length ? <p>No Stays yet.</p> : <ul>{stays.data.map(s => <li key={s.id}><Link href={`/admin/stays/${s.id}`}>{s.check_in ?? 'Undated Stay'}</Link> · {s.status}</li>)}</ul>}{(stays.count ?? 0) > 25 && <p>Showing 25 Stays. <Link href="/admin/stays">All Stays</Link></p>}</section>
 <DeleteForm action={deleteHotel.bind(null, id)} label="Delete Hotel" explanation="Delete only an unreferenced Hotel. Stays, Photos and pending imports block deletion; no archive data is cascaded." blocked={(stays.count ?? 0)+(photos.count??0)+(imports.count??0) > 0 ? 'This Hotel has Stays, Photos or pending imports. Keep it or unpublish it instead.' : undefined}/></main>;
}
