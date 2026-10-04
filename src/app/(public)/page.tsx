import type { Metadata } from 'next';
import Link from 'next/link';
import { homepagePhotos } from '@/lib/data/public-archive';
import { Photograph, PhotoGrid, photoLabel } from '@/components/public/photograph';
export const metadata: Metadata = { title: 'Found Along', description: 'Photography and places by Alex Lim', openGraph: { title: 'Found Along', description: 'Photography and places by Alex Lim', type: 'website' } };
export default async function HomePage() {
  const { photos, unavailable } = await homepagePhotos();
  const [opening, ...selection] = photos;
  return <main id="archive-content" className="archive-main archive-home"><h1 className="visually-hidden">Found Along</h1><p className="archive-byline">Photography and places by Alex Lim</p>
    {opening ? <><figure className="archive-opening"><Link href={`/photos/${opening.id}`} prefetch={false}><Photograph photo={opening} priority detail /></Link>
      <figcaption><Link href={`/photos/${opening.id}`} prefetch={false}>{photoLabel(opening)}</Link><span>{[opening.place.city, opening.place.country].filter(Boolean).join(' · ')}</span></figcaption></figure>
      {selection.length > 0 && <section aria-labelledby="selected-heading"><div className="archive-section-heading"><h2 id="selected-heading">Recent photography</h2><Link href="/photos">All photographs</Link></div><PhotoGrid photos={selection} /></section>}
    </> : <div className="archive-empty"><h2>{unavailable ? 'The archive is temporarily unavailable.' : 'The archive is taking shape.'}</h2><p>{unavailable ? 'Please try again later.' : 'Published photographs will appear here.'}</p></div>}
    <nav className="archive-entry-points" aria-label="Explore the archive"><Link href="/trips">Trips</Link><Link href="/singapore">Singapore <span>Home.</span></Link><Link href="/hotels">Hotels</Link></nav>
  </main>;
}
