import { notFound, permanentRedirect } from 'next/navigation';
import { validSlug } from '@/lib/data/public-places';
import { getHotel } from '@/lib/data/public-lodging';
export default async function LegacyHotel({ params }: { params: Promise<{ hotelSlug: string }> }) {
  const {hotelSlug}=await params;
  if(!validSlug(hotelSlug)) notFound();
  const hotel = await getHotel(hotelSlug);
  if (!hotel) notFound();
  permanentRedirect(`/hotels/${hotel.slug}`);
}
