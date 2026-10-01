import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getHotel } from '@/lib/data/public-lodging';
import { hotelPresentation } from '@/lib/data/public-stays';
import { createPublicClient } from '@/lib/supabase/public';
import { pageNumber, validSlug } from '@/lib/data/public-places';
import { JourneyOpening, SectionPages } from '@/components/public/journey';
import { PhotoGrid } from '@/components/public/photograph';
import { HotelEditorial, StayLinks } from '@/components/public/stay';
async function visibleHotel(slug: string) { if (!validSlug(slug))
    notFound(); const hotel = await getHotel(slug); if (!hotel)
    notFound(); return hotel; }
export async function generateMetadata({ params }: {
    params: Promise<{
        hotelSlug: string;
    }>;
}): Promise<Metadata> { const hotel = await visibleHotel((await params).hotelSlug); return { title: `${hotel.name} · Stays`, description: hotel.description ?? undefined, openGraph: { title: hotel.name, description: hotel.description ?? undefined, type: 'website' } }; }
export default async function Page({ params, searchParams }: {
    params: Promise<{
        hotelSlug: string;
    }>;
    searchParams: Promise<{
        stays?: string;
        photos?: string;
    }>;
}) {
    const hotel = await visibleHotel((await params).hotelSlug);
    const values = await searchParams;
    const page = pageNumber(values.stays);
    const photoPage = pageNumber(values.photos);
    const { city, cover, stays, nice } = await hotelPresentation(createPublicClient(), hotel, { stays: page, photos: photoPage });
    return <main id="archive-content" className="archive-main journey-detail"><Link className="archive-back" href="/stays">← Stays</Link><header className="journey-heading"><h1>{hotel.name}</h1>{city && <p className="journey-geography">{[city.name, city.country].filter(Boolean).join(', ')}</p>}{hotel.brand && <p className="stay-editorial">{hotel.brand}</p>}<HotelEditorial hotel={hotel}/></header>
    {cover && <JourneyOpening photo={cover}/>} {hotel.description && <p className="journey-description">{hotel.description}</p>}{hotel.address && <p className="stay-editorial">{hotel.address}</p>}
    {(nice.photos.length > 0 || photoPage > 1) && <section className="journey-section" id="photos"><h2>Photography</h2><PhotoGrid photos={nice.photos}/>{!nice.photos.length && <p>No more photographs.</p>}<SectionPages base={`/stays/${hotel.slug}`} values={values} name="photos" page={photoPage} hasNext={nice.hasNext}/></section>}
    <section className="journey-section" id="stays"><h2>My Stays</h2>{stays.stays.length ? <StayLinks stays={stays.stays}/> : <p>No published Stays on this page.</p>}<SectionPages base={`/stays/${hotel.slug}`} values={values} name="stays" page={page} hasNext={stays.hasNext}/><p className="stay-editorial">Visit a Stay for its photographs and review, where recorded.</p></section></main>;
}
