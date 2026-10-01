import type { Metadata } from 'next';
import Link from 'next/link';
import { publicTrips } from '@/lib/data/public-journeys';
import { pageNumber, tripDates } from '@/lib/data/public-places';
import { Photograph } from '@/components/public/photograph';
export const metadata:Metadata={title:'Trips · Travel archive',openGraph:{title:'Trips · Travel archive',type:'website'}};
export default async function TripsPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const page=pageNumber((await searchParams).page);
  const {trips,hasNext,unavailable}=await publicTrips(page);
  return <main id="archive-content" className="archive-main"><div className="archive-page-heading"><h1>Trips</h1></div>
    {trips.length ? <div className="journey-index">{trips.map((trip,index)=>{
      const dates=tripDates(trip);const countries=[...new Set(trip.cities.flatMap(c=>c.country?[c.country]:[]))];
      return <article className="journey-summary" key={trip.id}>
        {trip.cover&&<Link href={`/trips/${trip.slug}`} prefetch={false}><Photograph photo={trip.cover} priority={index<2} sizes="(max-width: 740px) calc(100vw - 32px), calc((min(100vw, 1440px) - 112px) / 2)" /></Link>}
        <h2><Link href={`/trips/${trip.slug}`} prefetch={false}>{trip.title}</Link></h2>
        {dates&&<p>{dates}</p>}{countries.length>0&&<p>{countries.join(' · ')}</p>}{trip.cities.length>0&&<p>{trip.cities.map(c=>c.name).join(' · ')}</p>}
      </article>;
    })}</div>:<div className="archive-empty"><p>{unavailable?'Trips are temporarily unavailable. Please try again later.':page>1?'No more Trips.':'No published Trips yet.'}</p></div>}
    {(page>1||hasNext)&&<nav className="archive-pagination" aria-label="Trip pages">{page>1&&<Link href={`/trips?page=${page-1}`}>Previous page</Link>}{hasNext&&<Link href={`/trips?page=${page+1}`}>Next page</Link>}</nav>}
  </main>;
}
