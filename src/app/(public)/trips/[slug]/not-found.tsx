import Link from 'next/link';
export default function TripNotFound() {
  return <main id="archive-content" className="archive-main archive-empty"><h1>Trip not found</h1><p>This Trip is not available in the public archive.</p><Link href="/trips">Back to Trips</Link></main>;
}
