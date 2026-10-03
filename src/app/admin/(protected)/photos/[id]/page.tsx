import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { uuidSchema } from '@/lib/validation/content';
import { readAll, getLocations, getStayCatalog } from '@/lib/admin/queries';
import { PhotoForm } from '@/components/admin/photo-form';
import { DeleteForm } from '@/components/admin/delete-form';
import { deletePhoto } from '../actions';

export default async function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { client } = await requireAdmin(); const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const { data: photo, error } = await client.from('photos').select('*').eq('id',id).maybeSingle();
  if (error) throw new Error('Unable to load Photo.'); if (!photo) notFound();
  const [locations, catalog, memberships] = await Promise.all([
    getLocations(client), getStayCatalog(client),
    readAll((from,to) => client.from('trip_locations').select('trip_id,location_id').order('trip_id').order('location_id').range(from,to)),
  ]);
  return <main><p><Link href="/admin/photos">Photos</Link></p><h1>{photo.filename}</h1>
    {photo.processing_status === 'ready' ? <>
      <Image className="admin-photo-preview" unoptimized src={`/admin/photos/${id}/image/medium`} width={photo.width} height={photo.height} alt={photo.caption || photo.filename} priority />
      <p><a href={`/admin/photos/${id}/image/source`}>Download private source JPEG</a> (may contain exact GPS; administrator only)</p>
      <PhotoForm photo={photo} trips={catalog.trips} locations={locations} memberships={memberships} hotels={catalog.hotels} />
    </> : <p className="error">Photo is hidden and its storage is not ready. An interrupted deletion must be retried below.</p>}
    <section className="content-section"><h2>Source and metadata</h2><dl className="photo-metadata">
      <dt>ID</dt><dd>{photo.id}</dd><dt>Dimensions</dt><dd>{photo.width} × {photo.height}</dd><dt>Source size</dt><dd>{(photo.file_size/1024/1024).toFixed(2)} MiB</dd>
      <dt>SHA-256</dt><dd>{photo.file_hash}</dd><dt>Captured at (EXIF wall time)</dt><dd>{photo.captured_at ?? 'Unknown'}{photo.captured_at_offset_minutes !== null ? ` · offset ${photo.captured_at_offset_minutes} minutes` : ' · timezone unknown'}</dd>
      <dt>Camera</dt><dd>{[photo.camera_make,photo.camera_model].filter(Boolean).join(' ') || 'Unknown'}</dd><dt>Lens</dt><dd>{photo.lens ?? 'Unknown'}</dd>
      <dt>Exposure</dt><dd>{photo.focal_length !== null ? `${photo.focal_length} mm` : 'Focal length unknown'} · {photo.aperture !== null ? `f/${photo.aperture}` : 'Aperture unknown'} · {photo.shutter_speed ?? 'Shutter unknown'} · {photo.iso !== null ? `ISO ${photo.iso}` : 'ISO unknown'}</dd>
      <dt>Exact GPS (private)</dt><dd>{photo.latitude !== null && photo.longitude !== null ? `${photo.latitude}, ${photo.longitude}` : 'Unknown'}</dd>
    </dl><p className="hint">GPS stays private. Future public geography uses the assigned Location or Hotel. Generated WebPs omit EXIF/GPS; the original source preserves exported bytes.</p></section>
    <DeleteForm action={deletePhoto.bind(null,id)} label="Delete Photo" explanation="Permanently delete the source and all four derivatives, then remove the Photo record. Lightroom is untouched. Covers block deletion; partial failures remain hidden and retryable." />
  </main>;
}
