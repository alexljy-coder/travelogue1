import type { Metadata } from 'next';
import Link from 'next/link';
import { galleryPhotos } from '@/lib/data/public-archive';
import { PhotoGrid } from '@/components/public/photograph';
export const metadata: Metadata = { title: 'Photos · Travel archive', description: 'Photographs from a personal visual travel archive.', openGraph: { title: 'Photos · Travel archive', description: 'Photographs from a personal visual travel archive.', type: 'website' } };
export default async function PhotosPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const parameters = await searchParams;
  const classification = parameters.view === 'record' ? 'record' : 'nice';
  const parsed = Number(parameters.page ?? 1);
  const page = Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100000 ? parsed : 1;
  const { photos, hasNext, unavailable } = await galleryPhotos(classification, page);
  const pageUrl = (number: number) => `/photos?${classification === 'record' ? 'view=record&' : ''}page=${number}`;
  return <main id="archive-content" className="archive-main"><div className="archive-page-heading"><h1>Photos</h1><nav className="archive-views" aria-label="Photography selection"><Link href="/photos" aria-current={classification === 'nice' ? 'page' : undefined}>Nice</Link><Link href="/photos?view=record" aria-current={classification === 'record' ? 'page' : undefined}>Record</Link></nav></div>
    {classification === 'record' && <p className="archive-intro">Photographs kept as a record of places and journeys.</p>}
    {photos.length ? <PhotoGrid photos={photos} /> : <div className="archive-empty"><p>{unavailable ? 'Photographs are temporarily unavailable. Please try again later.' : page > 1 ? 'No more photographs in this selection.' : `No published ${classification === 'record' ? 'Record' : 'Nice'} photographs yet.`}</p></div>}
    {(page > 1 || hasNext) && <nav className="archive-pagination" aria-label="Gallery pages">{page > 1 && <Link href={pageUrl(page - 1)}>Previous page</Link>}{hasNext && <Link href={pageUrl(page + 1)}>Next page</Link>}</nav>}
  </main>;
}
