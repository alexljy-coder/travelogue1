import Link from 'next/link';
export default function NotFound() {
  return <main id="archive-content" className="archive-main archive-empty"><h1>Photograph not found</h1><p>This photograph is not available in the public archive.</p><Link href="/photos">Back to Photos</Link></main>;
}
