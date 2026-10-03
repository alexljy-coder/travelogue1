import Link from 'next/link';
import { tripDates } from '@/lib/data/public-places';
import { recommendations, type PublicHotel, type PublicStay } from '@/lib/data/public-stays';
export function StayDates({ stay }: {
    stay: Pick<PublicStay, 'check_in' | 'check_out'>;
}) { const dates = tripDates({ start_date: stay.check_in, end_date: stay.check_out }); return <p className="journey-dates">{dates ?? 'Dates not recorded'}</p>; }
export function HotelEditorial({ hotel }: {
    hotel: Pick<PublicHotel, 'rating' | 'recommended_family' | 'recommended_business' | 'recommended_leisure'>;
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
}) { return <ul className="journey-place-list">{stays.map(stay => <li key={stay.id}>{stay.hotel && <Link href={`/stays/${stay.hotel.slug}`} prefetch={false}>{stay.hotel.name}</Link>}<StayDates stay={stay}/>{stay.trip && <span><Link href={`/trips/${stay.trip.slug}`} prefetch={false}>{stay.trip.title}</Link></span>}</li>)}</ul>; }

export function HotelReview({text}:{text:string|null}) {
  return text ? <section className="journey-section"><h2>Review</h2><div className="stay-review">{text}</div></section> : null;
}
