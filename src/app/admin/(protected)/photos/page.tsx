import Link from 'next/link';
import Image from 'next/image';
import { requireAdmin } from '@/lib/auth/require-admin';
import { uuidSchema } from '@/lib/validation/content';
import { notFound } from 'next/navigation';
import { listPage } from '@/lib/admin/display';

export default async function PhotosPage({ searchParams }: { searchParams: Promise<{ page?: string; deleted?: string; hotel?: string }> }) {
  const { client } = await requireAdmin();
  const query = await searchParams; const page = listPage(query.page);
  if(query.hotel && !uuidSchema.safeParse(query.hotel).success) notFound();
  let photos = client.from('photos').select('id,filename,width,height,caption,context,classification,status,processing_status,featured', {count:'exact'});
  if(query.hotel) photos=photos.eq('hotel_id',query.hotel).eq('context','hotel');
  const { data, count, error } = await photos.order('created_at',{ ascending: false }).order('id').range((page-1)*25,page*25-1);
  if (error || !data) throw new Error('Unable to load Photos.');
  return <main><div className="page-heading"><h1>Photos</h1><Link href={query.hotel ? `/admin/photos/import?hotel=${query.hotel}` : "/admin/photos/import"}>Import Lightroom JPEGs</Link></div>
    {query.deleted === '1' && <p role="status" className="success">Photo and its five R2 objects deleted.</p>}
    <p>Private photo management. Nice and Record are separate from Draft and Published.</p>
    {!data.length && <p>No Photos here yet. Import a small Lightroom test export to begin.</p>}
    <div className="admin-photo-grid">{data.map((photo) => <article className="panel" key={photo.id}>
      <Link href={`/admin/photos/${photo.id}`}>{photo.processing_status === 'ready' ? <Image unoptimized src={`/admin/photos/${photo.id}/image/thumbnail`} width={photo.width} height={photo.height} alt={photo.caption || photo.filename} /> : <p>Preview unavailable · deletion/recovery required</p>}<h2>{photo.filename}</h2></Link>
      <p>{photo.classification === 'nice' ? 'Nice' : 'Record'} · {photo.status === 'published' ? 'Published' : 'Draft'}{photo.featured ? ' · Featured' : ''}</p>
    </article>)}</div>
    <nav className="pagination" aria-label="Photo list pages">{page>1 && <Link href={`/admin/photos?page=${page-1}${query.hotel ? `&hotel=${query.hotel}` : ''}`}>Previous</Link>}{(count??0)>page*25 && <Link href={`/admin/photos?page=${page+1}${query.hotel ? `&hotel=${query.hotel}` : ''}`}>Next</Link>}</nav>
  </main>;
}
