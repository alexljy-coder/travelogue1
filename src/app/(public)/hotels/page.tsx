import type { Metadata } from 'next';
import Link from 'next/link';
import { publicHotels } from '@/lib/data/public-lodging';
import { pageNumber } from '@/lib/data/public-places';
import { Photograph } from '@/components/public/photograph';
import { HotelEditorial } from '@/components/public/hotel';
export const metadata: Metadata = { title: 'Hotels · Found Along', openGraph: { title: 'Hotels · Found Along', type: 'website' } };
export default async function Page({ searchParams }: {
    searchParams: Promise<{
        page?: string;
    }>;
}) {
    const page = pageNumber((await searchParams).page);
    const result = await publicHotels(page);
    return <main id="archive-content" className="archive-main"><header className="archive-page-heading"><h1>Hotels</h1></header>
    {result.unavailable ? <p>The Hotels archive is temporarily unavailable.</p> : !result.hotels.length ? <p>No published Hotels on this page yet.</p> : <div className="journey-index">{result.hotels.map((hotel, index) => <article className="journey-summary" key={hotel.id}>{hotel.cover && <Link href={`/hotels/${hotel.slug}`} prefetch={false}><Photograph photo={hotel.cover} priority={index === 0} sizes="(max-width: 740px) calc(100vw - 32px), calc((min(100vw, 1440px) - 112px) / 2)"/></Link>}<h2><Link href={`/hotels/${hotel.slug}`} prefetch={false}>{hotel.name}</Link></h2>{hotel.city && <p className="journey-geography">{[hotel.city.name, hotel.city.country].filter(Boolean).join(', ')}</p>}<HotelEditorial hotel={hotel}/></article>)}</div>}
    <nav className="archive-pagination" aria-label="Hotel archive pages">{page > 1 && <Link href={`/hotels?page=${page - 1}`}>Previous page</Link>}{result.hasNext && <Link href={`/hotels?page=${page + 1}`}>Next page</Link>}</nav></main>;
}
