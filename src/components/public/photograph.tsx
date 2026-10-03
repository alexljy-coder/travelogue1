import Link from 'next/link';
import { derivativeEdges, legacyDerivativeEdges, derivativeSize } from '@/lib/photos/model';
import type { PhotoWithContext } from '@/lib/data/public-photos';
import { publicVariants } from '@/lib/photos/public-image';
export function photoLabel(photo: PhotoWithContext) {
  return photo.caption || [photo.place.location || photo.place.hotel, photo.place.city, photo.place.country].filter(Boolean).join(', ') || 'Photograph';
}
export function responsiveSources(photo: Pick<PhotoWithContext, 'id' | 'width' | 'height'> & { derivative_profile?: number }) {
  const seen = new Set<number>();
  return publicVariants.flatMap((variant) => {
    const width = derivativeSize(photo.width, photo.height, (photo.derivative_profile === 2 ? derivativeEdges : legacyDerivativeEdges)[variant]).width;
    if (seen.has(width)) return [];
    seen.add(width);
    return [`/photos/${photo.id}/image/${variant} ${width}w`];
  }).join(', ');
}
export function Photograph({ photo, priority = false, detail = false, sizes, heightLimit = 85 }: { photo: PhotoWithContext; priority?: boolean; detail?: boolean; sizes?: string; heightLimit?: number }) {
  const heightWidth = `${(heightLimit * photo.width / photo.height).toFixed(2)}vh`;
  // Native srcSet avoids optimizer/shared caching and redundant recompression.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/photos/${photo.id}/image/${detail ? 'large' : 'thumbnail'}`} srcSet={responsiveSources(photo)}
    sizes={sizes ?? (detail ? `(max-width: 740px) min(calc(100vw - 32px), ${heightWidth}), (max-width: 1440px) min(calc(100vw - 80px), ${heightWidth}), min(1360px, ${heightWidth})` : '(max-width: 600px) calc(100vw - 32px), (max-width: 1000px) calc((100vw - 64px) / 2), calc((min(100vw, 1440px) - 112px) / 3)')}
    width={photo.width} height={photo.height} alt={photoLabel(photo)} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" />;
}
export function PhotoCard({ photo, priority = false, sizes }: { photo: PhotoWithContext; priority?: boolean; sizes?: string }) {
  return <figure className="archive-photo"><Link href={`/photos/${photo.id}`} prefetch={false}><Photograph photo={photo} priority={priority} sizes={sizes} /></Link>
    <figcaption><Link href={`/photos/${photo.id}`} prefetch={false}>{photoLabel(photo)}</Link>{photo.caption && photo.place.location && <span>{photo.place.location}</span>}</figcaption>
  </figure>;
}
export function PhotoGrid({ photos, priority = false }: { photos: PhotoWithContext[]; priority?: boolean }) {
  const sizes = photos.length === 1 ? '(max-width: 740px) calc(100vw - 32px), (max-width: 980px) calc(100vw - 80px), 900px'
    : photos.length === 2 ? '(max-width: 600px) calc(100vw - 32px), (max-width: 740px) calc((100vw - 52px) / 2), calc((min(100vw, 1440px) - 100px) / 2)' : undefined;
  return <div className="archive-grid" data-count={photos.length}>{photos.map((photo, index) => <PhotoCard key={photo.id} photo={photo} priority={priority && index < 2} sizes={sizes} />)}</div>;
}
