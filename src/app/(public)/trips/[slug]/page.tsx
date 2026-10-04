import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTrip, tripPresentation } from '@/lib/data/public-journeys';
import { pageNumber, validSlug } from '@/lib/data/public-places';
import { PhotoGrid } from '@/components/public/photograph';
import { JourneyOpening, SectionPages, TripIdentity } from '@/components/public/journey';
async function visibleTrip(slug:string){if(!validSlug(slug))notFound();const trip=await getTrip(slug);if(!trip)notFound();return trip;}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const trip=await visibleTrip((await params).slug);return{title:`${trip.title} · Found Along`,description:trip.description??undefined,openGraph:{title:trip.title,description:trip.description??undefined,type:'website'}};}
export default async function TripPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{photos?:string;record?:string;places?:string}>}){
  const trip=await visibleTrip((await params).slug);const values=await searchParams;
  const pages={photos:pageNumber(values.photos),record:pageNumber(values.record),places:pageNumber(values.places)};
  const {cover,cities,places,nice,record}=await tripPresentation(trip,pages);
  const base=`/trips/${trip.slug}`;
  return <main id="archive-content" className="archive-main journey-detail"><Link className="archive-back" href="/trips">← Trips</Link>
    <div className="journey-heading"><TripIdentity trip={trip}/>{cities.length>0&&<p className="journey-geography">{cities.map(c=>[c.name,c.country].filter(Boolean).join(', ')).join(' · ')}</p>}</div>
    {cover&&<JourneyOpening photo={cover}/>} {trip.description&&<p className="journey-description">{trip.description}</p>}
    {(places.places.length>0||pages.places>1)&&<section className="journey-section" id="places" aria-labelledby="places-title"><h2 id="places-title">Places</h2><ul className="journey-place-list">{places.places.map(place=><li key={place.id}><Link href={`/locations/${place.slug}`} prefetch={false}>{place.name}</Link>{place.city&&<span>{[place.city.name,place.city.country].filter(Boolean).join(', ')}</span>}</li>)}</ul><SectionPages base={base} values={values} name="places" page={pages.places} hasNext={places.hasNext}/></section>}
    {(nice.photos.length>0||pages.photos>1)&&<section className="journey-section" id="photos" aria-labelledby="journey-photos"><h2 id="journey-photos">Photography</h2><PhotoGrid photos={nice.photos}/>{!nice.photos.length&&<p>No more photographs.</p>}<SectionPages base={base} values={values} name="photos" page={pages.photos} hasNext={nice.hasNext}/></section>}
    {!cover&&!nice.photos.length&&pages.photos===1&&<p className="journey-empty">No published Nice photographs from this Trip yet.</p>}
    {(record.photos.length>0||pages.record>1)&&<section className="journey-section journey-record" id="record" aria-labelledby="record-title"><h2 id="record-title">The Record</h2><PhotoGrid photos={record.photos}/>{!record.photos.length&&<p>No more Record photographs.</p>}<SectionPages base={base} values={values} name="record" page={pages.record} hasNext={record.hasNext}/></section>}
  </main>;
}
