import type { Metadata } from 'next';
import Link from 'next/link';
import { homepagePhotos } from '@/lib/data/public-archive';
import { Photograph, PhotoGrid, photoLabel } from '@/components/public/photograph';
export const metadata: Metadata = { title: 'Travel archive', description: 'Photography, places and journeys from a personal travel archive.', openGraph: { title: 'Travel archive', description: 'Photography, places and journeys from a personal travel archive.', type: 'website' } };
export default async function HomePage() {
  const { photos, unavailable } = await homepagePhotos();
  const [opening, ...selection] = photos;
  return <main id="archive-content" className="archive-main archive-home"><h1 className="visually-hidden">Travel archive</h1>
    {opening ? <><figure className="archive-opening"><Link href={`/photos/${opening.id}`} prefetch={false}><Photograph photo={opening} priority detail /></Link>
      <figcaption><Link href={`/photos/${opening.id}`} prefetch={false}>{photoLabel(opening)}</Link><span>{[opening.place.city, opening.place.country].filter(Boolean).join(' · ')}</span></figcaption></figure>
      {selection.length > 0 && <section aria-labelledby="selected-heading"><div className="archive-section-heading"><h2 id="selected-heading">Selected photography</h2><Link href="/photos">All photographs</Link></div><PhotoGrid photos={selection} /></section>}
    </> : <div className="archive-empty"><h2>{unavailable ? 'The archive is temporarily unavailable.' : 'The archive is taking shape.'}</h2><p>{unavailable ? 'Please try again later.' : 'Published photographs will appear here.'}</p></div>}
  </main>;
}
