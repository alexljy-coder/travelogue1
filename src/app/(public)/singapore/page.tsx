import type { Metadata } from 'next';
import Link from 'next/link';
import { homeArchive } from '@/lib/data/public-home';
import { pageNumber } from '@/lib/data/public-places';
import { JourneyOpening, SectionPages } from '@/components/public/journey';
import { PhotoGrid } from '@/components/public/photograph';
export const metadata: Metadata = { title: 'Singapore · Found Along', description: 'Home. Photography and places by Alex Lim.', openGraph: { title: 'Singapore · Found Along', description: 'Home. Photography and places by Alex Lim.', type: 'website' } };
export default async function SingaporePage({ searchParams }: { searchParams: Promise<{ photos?: string; record?: string; places?: string }> }) {
  const values = await searchParams;
  const pages = { photos: pageNumber(values.photos), record: pageNumber(values.record), places: pageNumber(values.places) };
  const archive = await homeArchive(pages);
  return <main id="archive-content" className="archive-main">
    <header className="journey-heading"><h1>Singapore</h1><p className="archive-home-line">Home.</p></header>
    {archive.unavailable ? <div className="archive-empty"><p>Singapore is temporarily unavailable. Please try again later.</p></div> : <>
      {archive.opening && <JourneyOpening photo={archive.opening} />}
      <section id="photos" aria-labelledby="singapore-recent"><div className="archive-section-heading"><h2 id="singapore-recent">Recently</h2><Link href="/photos">Global photography</Link></div>
        {archive.nice.photos.some(photo => photo.id !== archive.opening?.id) ? <PhotoGrid photos={archive.nice.photos.filter(photo => photo.id !== archive.opening?.id)} /> : <p>{archive.opening ? 'No additional published photographs.' : 'No published Singapore photographs yet.'}</p>}
        <SectionPages base="/singapore" values={values} name="photos" page={pages.photos} hasNext={archive.nice.hasNext} />
      </section>
      <section id="places" aria-labelledby="singapore-places"><div className="archive-section-heading"><h2 id="singapore-places">Places</h2></div>
        {archive.places.places.length ? <ul className="journey-place-list">{archive.places.places.map(place => <li key={place.id}><Link href={`/locations/${place.slug}`} prefetch={false}>{place.name}</Link></li>)}</ul> : <p>No published Places yet.</p>}
        <SectionPages base="/singapore" values={values} name="places" page={pages.places} hasNext={archive.places.hasNext} />
      </section>
      <section id="record" aria-labelledby="singapore-record"><div className="archive-section-heading"><h2 id="singapore-record">The Record</h2></div>
        {archive.record.photos.length ? <PhotoGrid photos={archive.record.photos} /> : <p>No published Record photographs here yet.</p>}
        <SectionPages base="/singapore" values={values} name="record" page={pages.record} hasNext={archive.record.hasNext} />
      </section>
    </>}
  </main>;
}
