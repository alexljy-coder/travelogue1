import Link from 'next/link';
import { tripDates } from '@/lib/data/public-places';
import { recommendations, type PublicHotel, type PublicStay } from '@/lib/data/public-stays';
export function StayDates({ stay }: {
    stay: Pick<PublicStay, 'check_in' | 'check_out'>;
}) { const dates = tripDates({ start_date: stay.check_in, end_date: stay.check_out }); return <p className="journey-dates">{dates ?? 'Dates not recorded'}</p>; }
export function HotelEditorial({ hotel }: {
    hotel: PublicHotel;
}) { const categories = recommendations(hotel); return <>{hotel.rating !== null && <p className="stay-editorial">Personal rating: {hotel.rating} / 5 stars</p>}{categories.length > 0 && <p className="stay-editorial">Recommended for {categories.join(', ')}</p>}</>; }
export function StayLinks({ stays }: {
    stays: (PublicStay & {
        hotel: {
            slug: string;
            name: string;
        } | null;
        trip: {
            slug: string;
            title: string;
        } | null;
    })[];
}) { return <ul className="journey-place-list">{stays.map(stay => <li key={stay.id}>{stay.hotel && <Link href={`/stays/${stay.hotel.slug}/${stay.id}`} prefetch={false}>{stay.hotel.name}</Link>}<StayDates stay={stay}/>{stay.trip && <span><Link href={`/trips/${stay.trip.slug}`} prefetch={false}>{stay.trip.title}</Link></span>}{stay.rating !== null && <span>Personal rating: {stay.rating} / 5 stars</span>}</li>)}</ul>; }
