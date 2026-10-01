import Link from 'next/link';
import Image from 'next/image';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listPage } from '@/lib/admin/display';

export default async function PhotosPage({ searchParams }: { searchParams: Promise<{ page?: string; deleted?: string }> }) {
  const { client } = await requireAdmin();
  const query = await searchParams; const page = listPage(query.page);
  const { data, count, error } = await client.from('photos').select('id,filename,width,height,caption,context,classification,status,processing_status,featured').order('created_at',{ ascending: false }).order('id').range((page-1)*25,page*25-1);
  if (error || !data) throw new Error('Unable to load Photos.');
  return <main><div className="page-heading"><h1>Photos</h1><Link href="/admin/photos/import">Import Lightroom JPEGs</Link></div>
    {query.deleted === '1' && <p role="status" className="success">Photo and its five R2 objects deleted.</p>}
    <p>Private Travel photo management. Nice and Record are separate from Draft and Published.</p>
    {!data.length && <p>No Photos here yet. Import a small Lightroom test export to begin.</p>}
    <div className="admin-photo-grid">{data.map((photo) => <article className="panel" key={photo.id}>
      <Link href={`/admin/photos/${photo.id}`}>{photo.processing_status === 'ready' ? <Image unoptimized src={`/admin/photos/${photo.id}/image/thumbnail`} width={photo.width} height={photo.height} alt={photo.caption || photo.filename} /> : <p>Preview unavailable · deletion/recovery required</p>}<h2>{photo.filename}</h2></Link>
      <p>{photo.classification === 'nice' ? 'Nice' : 'Record'} · {photo.status === 'published' ? 'Published' : 'Draft'}{photo.featured ? ' · Featured' : ''}</p>
    </article>)}</div>
    <nav className="pagination" aria-label="Photo list pages">{page>1 && <Link href={`/admin/photos?page=${page-1}`}>Previous</Link>}{(count??0)>page*25 && <Link href={`/admin/photos?page=${page+1}`}>Next</Link>}</nav>
  </main>;
}
