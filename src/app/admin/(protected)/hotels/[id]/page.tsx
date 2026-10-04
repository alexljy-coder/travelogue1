import Link from 'next/link';
import { HotelPhotos } from '@/components/admin/hotel-photos';
import {readAll} from '@/lib/admin/queries';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getGeography } from '@/lib/admin/queries';
import { uuidSchema } from '@/lib/validation/content';
import { HotelForm } from '@/components/admin/hotel-form';
import { DeleteForm } from '@/components/admin/delete-form';
import { deleteHotel } from '../../hotel-actions';
export default async function Page({ params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { client } = await requireAdmin();
    const { id } = await params;
    if (!uuidSchema.safeParse(id).success)
        notFound();
    const [record, geography, photos, imports, covers] = await Promise.all([client.from('hotels').select('*').eq('id', id).maybeSingle(), getGeography(client),
 client.from('photos').select('id,filename,caption,width,height,processing_status,status,classification,featured',{count:'exact'}).eq('hotel_id',id).order('created_at',{ascending:false}).order('id').limit(25),
 client.from('import_items').select('id',{count:'exact',head:true}).eq('hotel_id',id),
 readAll((from,to)=>client.from('photos').select('id,filename,caption').eq('hotel_id',id).eq('context','hotel').eq('status','published').eq('classification','nice').eq('processing_status','ready').order('created_at',{ascending:false}).order('id').range(from,to))]);
    if (record.error || photos.error || imports.error)
        throw new Error('Unable to load Hotel.');
    if (!record.data)
        notFound();
    return <main><Link href="/admin/hotels">Hotels</Link><h1>{record.data.name}</h1><HotelForm hotel={record.data} {...geography} covers={covers} photos={<HotelPhotos hotelId={id} photos={photos.data ?? []} count={photos.count ?? 0} coverId={record.data.cover_photo_id}/>}/>
 <DeleteForm action={deleteHotel.bind(null, id)} label="Delete Hotel" explanation="Delete only an unreferenced Hotel. Photos and pending imports block deletion; no archive data is cascaded." blocked={(photos.count??0)+(imports.count??0) > 0 ? 'This Hotel has Photos or pending imports. Keep it or unpublish it instead.' : undefined}/></main>;
}
