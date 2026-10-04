import Link from 'next/link';
type HotelPhoto = {id:string;filename:string;caption:string|null;width:number;height:number;processing_status:string;status:string;classification:string;featured:boolean};
export function HotelPhotos({hotelId,photos,count,coverId}:{hotelId:string;photos:HotelPhoto[];count:number;coverId:string|null}) {
 return <section className="content-section" aria-labelledby="hotel-photos-heading"><h2 id="hotel-photos-heading">Photos</h2>
 <p><Link className="button-link" href={`/admin/photos/import?hotel=${hotelId}`}>Add Photos</Link></p>
 <p>Import JPEGs directly into this Hotel gallery. New photos are Draft. Open a photo below to edit its classification, publication or Featured setting.</p>
 {!photos.length && <p>No Hotel photos yet. Add Photos to begin.</p>}
 <div className="admin-photo-grid">{photos.map(photo=><article key={photo.id}><Link href={`/admin/photos/${photo.id}`}>
 {/* Private generated derivatives bypass shared optimization. */}
 {/* eslint-disable-next-line @next/next/no-img-element */}
 {photo.processing_status==='ready' && <img loading="lazy" src={`/admin/photos/${photo.id}/image/thumbnail`} width={photo.width} height={photo.height} alt={photo.caption || photo.filename}/>}
 <p>{photo.filename} · {photo.classification} · {photo.status}{photo.id===coverId?' · Selected cover':''}{photo.featured?' · Featured':''}</p></Link></article>)}</div>
 {count>photos.length && <p>Showing {photos.length} of {count} Hotel photos. <Link href={`/admin/photos?hotel=${hotelId}`}>All photos for this Hotel</Link></p>}
 <p className="hint">Choose the cover below from Published Nice Hotel photos. Automatic uses a safe eligible fallback.</p></section>;
}
