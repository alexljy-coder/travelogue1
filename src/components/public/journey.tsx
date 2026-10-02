import Link from 'next/link';
import { Photograph, photoLabel } from './photograph';
import type { PhotoWithContext } from '@/lib/data/public-photos';
import { tripDates, type PublicTrip } from '@/lib/data/public-places';
export function JourneyOpening({photo}:{photo:PhotoWithContext}) {
  return <figure className="archive-opening journey-opening"><Link href={`/photos/${photo.id}`} prefetch={false}><Photograph photo={photo} detail priority /></Link><figcaption><Link href={`/photos/${photo.id}`} prefetch={false}>{photoLabel(photo)}</Link></figcaption></figure>;
}
export function TripIdentity({trip}:{trip:PublicTrip}) {
  const dates=tripDates(trip);
  return <><h1>{trip.title}</h1>{dates && <p className="journey-dates">{dates}</p>}</>;
}
export function SectionPages({base,values,name,page,hasNext}:{base:string;values:Record<string,string|undefined>;name:string;page:number;hasNext:boolean}) {
  const href=(value:number)=>{const params=new URLSearchParams();for(const[key,v]of Object.entries(values))if(v)params.set(key,v);params.set(name,String(value));return `${base}?${params.toString()}#${name}`;};
  return page>1||hasNext ? <nav className="archive-pagination" aria-label={`${name === 'record' ? 'The Record' : name} pages`}>{page>1&&<Link href={href(page-1)} prefetch={false}>Previous page</Link>}{hasNext&&<Link href={href(page+1)} prefetch={false}>Next page</Link>}</nav>:null;
}
export function PhotoContextLinks({photo}:{photo:PhotoWithContext}) {
  return <nav className="journey-context-links" aria-label="Photo archive context">
    {photo.context === 'travel' && photo.place.country_code === 'SG' && <Link href="/singapore">Singapore · Home</Link>}
    {photo.place.trip_slug&&<Link href={`/trips/${photo.place.trip_slug}`} prefetch={false}>{photo.place.trip}</Link>}
    {photo.place.hotel_slug&&<Link href={`/stays/${photo.place.hotel_slug}`} prefetch={false}>{photo.place.hotel}</Link>}
    {photo.place.hotel_slug&&photo.place.stay_id&&<Link href={`/stays/${photo.place.hotel_slug}/${photo.place.stay_id}`} prefetch={false}>This Stay</Link>}
    {photo.place.location_slug&&<Link href={`/locations/${photo.place.location_slug}`} prefetch={false}>{photo.place.location}</Link>}
  </nav>;
}
