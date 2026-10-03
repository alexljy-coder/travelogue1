export type PublicationStatus = 'draft' | 'published';
export type PhotoForPublishing = {
  status: PublicationStatus;
  classification: 'nice' | 'record';
  context: 'travel' | 'hotel';
  processing_status: 'pending' | 'ready' | 'failed';
  featured: boolean;
  trip_id: string | null;
  location_id: string | null;
  hotel_id: string | null;
};
export type PhotoParents = {
  trip?: { id: string; status: PublicationStatus };
  location?: { id: string; status: PublicationStatus; country_code?: string };
  hotel?: { id: string; status: PublicationStatus };
  tripLocationAssociated?: boolean;
};

// Preflight for future publishing mutations. RLS independently prevents parent-state races/leaks.
// Callers must obtain these snapshots from the database, never trust browser-supplied statuses.
export function photoPublicationErrors(photo: PhotoForPublishing, parents: PhotoParents): string[] {
  const errors: string[] = [];
  if (photo.context === 'travel' && photo.hotel_id !== null) errors.push('Travel photos cannot reference a Hotel.');
  if (photo.context === 'hotel' && (photo.trip_id !== null || photo.location_id !== null)) errors.push('Hotel photos use only a Hotel assignment.');
  if (photo.featured && (photo.status !== 'published' || photo.classification !== 'nice')) errors.push('Featured photos must be Published and Nice.');
  if (photo.status !== 'published') return errors;
  if (photo.processing_status !== 'ready') errors.push('Source and derivatives must be ready before publication.');
  if (photo.context === 'travel') {
    if (photo.trip_id ? parents.trip?.id !== photo.trip_id || parents.trip.status !== 'published' : parents.location?.country_code !== 'SG') errors.push('A published Trip is required outside Singapore, and any assigned Trip must be Published.');
    if (!photo.location_id || parents.location?.id !== photo.location_id || parents.location.status !== 'published') errors.push('A published Location is required.');
    if (photo.trip_id && !parents.tripLocationAssociated) errors.push('The Location must belong to this Trip.');
  } else {
    if (!photo.hotel_id || parents.hotel?.id !== photo.hotel_id || parents.hotel.status !== 'published') errors.push('A published Hotel is required.');
  }
  return errors;
}

export type CoverTarget =
  | { type: 'trip'; id: string }
  | { type: 'location'; id: string }
  | { type: 'hotel'; id: string };

export function coverEligible(photo: PhotoForPublishing, parents: PhotoParents, target: CoverTarget): boolean {
  if (photo.classification !== 'nice' || photo.status !== 'published' || photoPublicationErrors(photo, parents).length > 0) return false;
  if (target.type === 'trip') return photo.context === 'travel' && photo.trip_id === target.id;
  if (target.type === 'location') return photo.context === 'travel' && photo.location_id === target.id;
  return photo.context === 'hotel' && photo.hotel_id === target.id;
}

export function stayPublicationErrors(status: PublicationStatus, tripStatus: PublicationStatus | null, hotelStatus: PublicationStatus, countryCode?: string): string[] {
  if (status !== 'published') return [];
  return (tripStatus === 'published' || tripStatus === null && countryCode === 'SG') && hotelStatus === 'published' ? [] : ['A published Trip and Hotel are required.'];
}
