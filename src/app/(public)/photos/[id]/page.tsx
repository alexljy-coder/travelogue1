import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicPhoto } from '@/lib/data/public-archive';
import { isPhotoId } from '@/lib/data/public-photos';
import { Photograph, photoLabel } from '@/components/public/photograph';
import { PhotoContextLinks } from '@/components/public/journey';
async function photoOrNotFound(id: string) {
  if (!isPhotoId(id)) notFound();
  const photo = await getPublicPhoto(id);
  if (!photo) notFound();
  return photo;
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const photo = await photoOrNotFound((await params).id);
  const title = `${photoLabel(photo)} · Found Along`;
  const description = photo.description || photo.caption || [photo.place.location || photo.place.hotel, photo.place.city, photo.place.country].filter(Boolean).join(', ') || 'A photograph from the travel archive.';
  // OG title/text only until a canonical public domain is deliberately configured.
  return { title, description, openGraph: { title, description, type: 'website' } };
}
export default async function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const photo = await photoOrNotFound((await params).id);
  const date = photo.captured_at ? new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(photo.captured_at.slice(0, 10) + 'T00:00:00Z')) : null;
  const metadata = [
    ['Location', photo.place.location], ['Hotel',photo.place.hotel], ['City', photo.place.city], ['Country', photo.place.country], ['Trip', photo.place.trip], ['Captured', date],
    ['Camera', [photo.camera_make, photo.camera_model].filter(Boolean).join(' ') || null], ['Lens', photo.lens],
    ['Focal length', photo.focal_length ? `${photo.focal_length} mm` : null], ['Aperture', photo.aperture ? `ƒ/${photo.aperture}` : null], ['Shutter', photo.shutter_speed], ['ISO', photo.iso ? String(photo.iso) : null],
  ].filter((entry): entry is [string, string] => !!entry[1]);
  return <main id="archive-content" className="archive-main archive-detail"><Link className="archive-back" href={photo.classification === 'record' ? '/photos?view=record' : '/photos'}>← Photos{photo.classification === 'record' ? ' / Record' : ''}</Link>
    <figure className="archive-detail-image"><Photograph photo={photo} detail priority /></figure>
    <div className="archive-detail-text"><section><h1>{photoLabel(photo)}</h1>{photo.description && <p className="archive-description">{photo.description}</p>}<PhotoContextLinks photo={photo}/></section>
      {metadata.length > 0 && <dl className="archive-metadata">{metadata.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    </div></main>;
}
