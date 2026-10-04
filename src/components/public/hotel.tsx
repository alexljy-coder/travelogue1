import { recommendations, type PublicHotel } from '@/lib/data/public-hotels';
export function HotelEditorial({ hotel }: {
    hotel: Pick<PublicHotel, 'rating' | 'recommended_family' | 'recommended_business' | 'recommended_leisure'>;
}) { const categories = recommendations(hotel); return <>{hotel.rating !== null && <p className="hotel-editorial">Personal rating: {hotel.rating} / 5 stars</p>}{categories.length > 0 && <p className="hotel-editorial">Recommended for {categories.join(', ')}</p>}</>; }
export function HotelReview({text}:{text:string|null}) {
  return text ? <section className="journey-section"><h2>Review</h2><div className="hotel-review">{text}</div></section> : null;
}
