import Link from 'next/link';
export default function LocationNotFound() {
  return <main id="archive-content" className="archive-main archive-empty"><h1>Place not found</h1><p>This place is not available in the public archive.</p><Link href="/trips">Back to Trips</Link></main>;
}
