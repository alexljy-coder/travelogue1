import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocation, locationPresentation } from '@/lib/data/public-journeys';
import { pageNumber, tripDates, validSlug } from '@/lib/data/public-places';
import { PhotoGrid } from '@/components/public/photograph';
import { JourneyOpening, SectionPages } from '@/components/public/journey';
async function visibleLocation(slug:string){if(!validSlug(slug))notFound();const location=await getLocation(slug);if(!location)notFound();return location;}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const location=await visibleLocation((await params).slug);return{title:`${location.name} · Travel archive`,description:location.description??undefined,openGraph:{title:location.name,description:location.description??undefined,type:'website'}};}
export default async function LocationPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{photos?:string;trips?:string}>}){
  const location=await visibleLocation((await params).slug);const values=await searchParams;const pages={photos:pageNumber(values.photos),trips:pageNumber(values.trips)};
  const {cover,city,trips,nice}=await locationPresentation(location,pages);const base=`/locations/${location.slug}`;
  return <main id="archive-content" className="archive-main journey-detail"><Link className="archive-back" href="/trips">← Trips</Link><div className="journey-heading"><h1>{location.name}</h1>{city&&<p className="journey-geography">{[city.name,city.country].filter(Boolean).join(', ')}</p>}</div>
    {cover&&<JourneyOpening photo={cover}/>} {location.description&&<p className="journey-description">{location.description}</p>}
    {(nice.photos.length>0||pages.photos>1)&&<section className="journey-section" id="photos" aria-labelledby="place-photos"><h2 id="place-photos">Photography</h2><PhotoGrid photos={nice.photos}/>{!nice.photos.length&&<p>No more photographs.</p>}<SectionPages base={base} values={values} name="photos" page={pages.photos} hasNext={nice.hasNext}/></section>}
    {!cover&&!nice.photos.length&&pages.photos===1&&<p className="journey-empty">No published Nice photographs from this place yet.</p>}
    {(trips.trips.length>0||pages.trips>1)&&<section className="journey-section" id="trips" aria-labelledby="place-trips"><h2 id="place-trips">Trips through this place</h2><ul className="journey-place-list">{trips.trips.map(trip=><li key={trip.id}><Link href={`/trips/${trip.slug}`} prefetch={false}>{trip.title}</Link>{tripDates(trip)&&<span>{tripDates(trip)}</span>}</li>)}</ul><SectionPages base={base} values={values} name="trips" page={pages.trips} hasNext={trips.hasNext}/></section>}
  </main>;
}
