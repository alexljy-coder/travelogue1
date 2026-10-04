import Link from 'next/link';
import { getPhotoCatalog } from '@/lib/admin/queries';
import { notFound } from 'next/navigation';
import { uuidSchema } from '@/lib/validation/content';
import { requireAdmin } from '@/lib/auth/require-admin';
import { PhotoImporter } from '@/components/admin/photo-importer';
import { ImportRecovery } from '@/components/admin/import-recovery';

export default async function ImportPage({searchParams}:{searchParams:Promise<{hotel?:string}>}) {
  const { client } = await requireAdmin();
  const params=await searchParams;const catalog=await getPhotoCatalog(client);
  const target = params.hotel ? catalog.hotels.find(h=>uuidSchema.safeParse(params.hotel).success && h.id===params.hotel) : undefined;
  if (params.hotel && !target) notFound();
  const [items, batches] = await Promise.all([
    client.from('import_items').select('id,filename,state,error,lease_until,created_at').order('created_at',{ ascending: false }).order('id').limit(25),
    client.from('import_batches').select('*').order('created_at',{ ascending: false }).order('id').limit(10),
  ]);
  return <main><p><Link href="/admin/photos">Photos</Link></p><h1>Import Lightroom JPEGs</h1>
    {target && <p>Adding photos to <Link href={`/admin/hotels/${target.id}`}>{target.name}</Link>. Hotel context is already selected.</p>}
    <PhotoImporter hotels={catalog.hotels} hotelId={target?.id} />
    <section className="content-section"><h2>Recent import status</h2><p>Refresh to check an uncertain result. Interrupted operations retain their UUID for recovery. An active lease must expire before cleanup/retry is allowed.</p>
      {items.error ? <p className="error">Import status is unavailable. Apply the Milestone 3 migration before importing.</p> : !items.data?.length ? <p>No import attempts yet.</p> : items.data.map((item) => <article className="panel" key={item.id}>
        <h3>{item.filename}</h3><p>{item.state} · {item.id}</p>
        {item.error && <p className="error">{item.error}</p>}
        {item.lease_until && <p>Operation lease until {item.lease_until}. Reload after it expires if the browser was interrupted.</p>}
        {item.state === 'complete' && <Link href={`/admin/photos/${item.id}`}>Edit Photo</Link>}
        {item.state === 'deleting' && <Link href={`/admin/photos/${item.id}`}>Retry Photo deletion</Link>}
        {!['complete','deleted','deleting'].includes(item.state) && <ImportRecovery id={item.id} />}
      </article>)}
    </section>
    <section className="content-section"><h2>Recent batches</h2>{batches.error ? <p>Batch history could not be loaded.</p> : !batches.data?.length ? <p>No batches yet.</p> : <ul>{batches.data.map((batch) => <li key={batch.id}>{batch.created_at} · {batch.status} · {batch.imported} imported / {batch.eligible_files} eligible · {batch.skipped_personal} Personal skipped</li>)}</ul>}</section>
  </main>;
}
