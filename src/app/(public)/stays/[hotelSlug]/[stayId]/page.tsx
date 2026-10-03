import { notFound, redirect } from 'next/navigation';
import { getHotel, getStay } from '@/lib/data/public-lodging';
// Resolve under anonymous RLS before redirecting; Draft/wrong-property visits stay 404.
export default async function Page({params}:{params:Promise<{hotelSlug:string;stayId:string}>}) {
  const {hotelSlug,stayId}=await params;
  const hotel=await getHotel(hotelSlug);
  if(!hotel || !await getStay(hotel.id,stayId)) notFound();
  redirect(`/stays/${hotel.slug}`);
}
