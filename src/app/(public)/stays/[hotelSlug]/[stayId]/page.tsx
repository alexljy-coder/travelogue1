import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getHotel, getStay } from '@/lib/data/public-lodging';
import { stayPresentation } from '@/lib/data/public-stays';
import { createPublicClient } from '@/lib/supabase/public';
import { pageNumber, validSlug, geography } from '@/lib/data/public-places';
import { PhotoGrid } from '@/components/public/photograph';
import { JourneyOpening, SectionPages } from '@/components/public/journey';
import { HotelEditorial, StayDates } from '@/components/public/stay';
async function visible(params: {
    hotelSlug: string;
    stayId: string;
}) { if (!validSlug(params.hotelSlug))
    notFound(); const hotel = await getHotel(params.hotelSlug); if (!hotel)
    notFound(); const stay = await getStay(hotel.id, params.stayId); if (!stay)
    notFound(); return { hotel, stay }; }
export async function generateMetadata({ params }: {
    params: Promise<{
        hotelSlug: string;
        stayId: string;
    }>;
}): Promise<Metadata> { const { hotel } = await visible(await params); return { title: `Stay at ${hotel.name} · Travel archive`, openGraph: { title: `Stay at ${hotel.name}`, type: 'website' } }; }
export default async function Page({ params, searchParams }: {
    params: Promise<{
        hotelSlug: string;
        stayId: string;
    }>;
    searchParams: Promise<{
        photos?: string;
        record?: string;
    }>;
}) {
    const { hotel, stay } = await visible(await params);
    const values = await searchParams;
    const pages = { photos: pageNumber(values.photos), record: pageNumber(values.record) };
    const client = createPublicClient();
    const [{ cover, nice, record, trip }, cities] = await Promise.all([stayPresentation(client, stay, pages), geography(client, [hotel.city_id])]);
    const city = cities[0];
    const base = `/stays/${hotel.slug}/${stay.id}`;
    return <main id="archive-content" className="archive-main journey-detail"><Link className="archive-back" href={`/stays/${hotel.slug}`}>← {hotel.name}</Link><header className="journey-heading"><h1>Stay at {hotel.name}</h1><StayDates stay={stay}/>{city && <p className="journey-geography">{[city.name, city.country].filter(Boolean).join(', ')}</p>}{trip && <p className="stay-editorial"><Link href={`/trips/${trip.slug}`} prefetch={false}>{trip.title}</Link></p>}</header>
    {cover && <JourneyOpening photo={cover}/>}<div className="stay-context">{stay.room_type && <p>Room: {stay.room_type}</p>}{stay.purpose && <p>Purpose: {stay.purpose[0].toUpperCase() + stay.purpose.slice(1)}</p>}{stay.rating !== null && <p>Personal rating: {stay.rating} / 5 stars</p>}<HotelEditorial hotel={{ ...hotel, rating: null }}/></div>
    {stay.review_text && <section className="journey-section"><h2>Review</h2><div className="stay-review">{stay.review_text}</div></section>}
    {(nice.photos.length > 0 || pages.photos > 1) && <section className="journey-section" id="photos"><h2>Photography</h2><PhotoGrid photos={nice.photos}/>{!nice.photos.length && <p>No more photographs.</p>}<SectionPages base={base} values={values} name="photos" page={pages.photos} hasNext={nice.hasNext}/></section>}
    {!cover && !nice.photos.length && pages.photos === 1 && <p className="journey-empty">No published Nice photographs from this Stay yet.</p>}
    {(record.photos.length > 0 || pages.record > 1) && <section className="journey-section journey-record" id="record"><h2>The Record</h2><PhotoGrid photos={record.photos}/>{!record.photos.length && <p>No more Record photographs.</p>}<SectionPages base={base} values={values} name="record" page={pages.record} hasNext={record.hasNext}/></section>}
    </main>;
}
