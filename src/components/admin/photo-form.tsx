'use client';

import { useActionState, useState } from 'react';
import { savePhoto } from '@/app/admin/(protected)/photos/actions';
import type { Photo } from '@/lib/photos/ingestion';
import type { Trip, Location, StayOption } from '@/lib/admin/catalog';
import { emptyFormState } from '@/lib/admin/form-state';
import { DescriptionField, Feedback, Field, StatusField } from './form-fields';

export function PhotoForm({ photo, trips, locations, memberships, stays }: { photo: Photo; trips: Trip[]; locations: Location[]; stays: StayOption[]; memberships: { trip_id: string; location_id: string }[] }) {
  const [state, action, pending] = useActionState(savePhoto.bind(null, photo.id), emptyFormState);
  const [tripId, setTripId] = useState(photo.trip_id ?? '');
  const [locationId, setLocationId] = useState(photo.location_id ?? '');
  const [context,setContext]=useState(photo.context);
  const formId = 'photo-editor';
  const choices = tripId ? locations.filter((location) => memberships.some((link) => link.trip_id === tripId && link.location_id === location.id)) : locations;
  return <form id={formId} action={action} className="editor">
    <Feedback state={state} />
    <div className="field"><label htmlFor={`${formId}-classification`}>Classification (required)</label><select id={`${formId}-classification`} name="classification" defaultValue={state.values?.classification ?? photo.classification} required><option value="nice">Nice</option><option value="record">Record</option></select><span className="field-error">{state.errors?.classification}</span></div>
    <div className="field"><label htmlFor="photo-context">Context (required)</label><select id="photo-context" name="context" value={context} onChange={e=>{setContext(e.target.value);setTripId('');setLocationId('');}}><option value="travel">Travel</option><option value="hotel">Hotel</option></select><span className="field-error">{state.errors?.context}</span></div>
    <StatusField formId={formId} state={state} initial={photo.status} />
    {context==='travel'?<><input type="hidden" name="stay_id" value=""/><div className="field"><label htmlFor={`${formId}-trip`}>Trip (required when Published)</label><select id={`${formId}-trip`} name="trip_id" value={tripId} onChange={(event) => { const next = event.target.value; setTripId(next); if (next && !memberships.some((link) => link.trip_id === next && link.location_id === locationId)) setLocationId(''); }}><option value="">Not assigned</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title} · {trip.status}</option>)}</select><span className="field-error">{state.errors?.trip_id}</span></div>
    <div className="field"><label htmlFor={`${formId}-location`}>Location (required when Published)</label><select id={`${formId}-location`} name="location_id" value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Not assigned</option>{choices.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.status}</option>)}</select><span className="field-error">{state.errors?.location_id}</span></div>
    <p className="hint">Add Locations to the Trip in Trips first. Publishing also requires both parents to be Published. Unknown assignments can stay Draft.</p>
    </>:<><input type="hidden" name="trip_id" value=""/><input type="hidden" name="location_id" value=""/><div className="field"><label htmlFor="photo-stay">Stay (required when Published)</label><select key={context} id="photo-stay" name="stay_id" defaultValue={state.values?.stay_id??photo.stay_id??''}><option value="">Not assigned</option>{stays.map(s=><option key={s.id} value={s.id}>{s.hotel_name} · {s.check_in??'Undated'} · {s.trip_title} · {s.status}</option>)}</select><span className="field-error">{state.errors?.stay_id}</span></div><p className="hint">Hotel photos derive geography and Trip through the Stay. Publishing requires a Published Stay, Hotel and Trip; no Location is needed.</p></>}
    <label className="checkbox"><input type="checkbox" name="featured" value="yes" defaultChecked={state.values ? state.values.featured === 'yes' : photo.featured} />Featured (optional; Published + Nice only)</label><span className="field-error">{state.errors?.featured}</span>
    <Field formId={formId} state={state} name="caption" label="Caption (optional)" maxLength={2000} initial={photo.caption} />
    <DescriptionField formId={formId} state={state} initial={photo.description} />
    <Field formId={formId} state={state} name="editorial_order" label="Display position (optional)" type="number" min={0} step={1} initial={photo.editorial_order} />
    <button disabled={pending}>{pending ? 'Saving…' : 'Save Photo'}</button>
  </form>;
}
