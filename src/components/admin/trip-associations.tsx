'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { removeTripCity, removeTripLocation, setTripCity, setTripLocation } from '@/app/admin/(protected)/content-actions';
import type { CityOption, Country, Location } from '@/lib/admin/catalog';
import { emptyFormState } from '@/lib/admin/form-state';
import { CityChoice } from './city-choice';
import { DeleteForm } from './delete-form';
import { Feedback, Field } from './form-fields';

export function AddTripCity({ tripId, cities, countries }: { tripId: string; cities: CityOption[]; countries: Country[] }) {
  const formId = 'add-trip-city';
  const [cityId, setCityId] = useState('');
  const [state, action, pending] = useActionState(setTripCity.bind(null, tripId), emptyFormState);
  return <div className="panel">
    <CityChoice formId={formId} cities={cities} countries={countries} value={cityId} onChange={setCityId} state={state} />
    <form id={formId} action={action}><Feedback state={state} /><Field formId={formId} state={state} name="sequence" label="Position in Trip (optional)" type="number" step={1} min={0} /><button disabled={pending} type="submit">{pending ? 'Saving…' : 'Add City to Trip'}</button></form>
  </div>;
}
export function TripCityRow({ tripId, city, sequence }: { tripId: string; city: CityOption; sequence: number | null }) {
  const formId = `city-${city.id}`;
  const [state, action, pending] = useActionState(setTripCity.bind(null, tripId), emptyFormState);
  return <article className="panel"><h3>{city.name} · {city.country_name}</h3>
    <form id={formId} action={action}><Feedback state={state} /><input type="hidden" name="city_id" value={city.id} /><Field formId={formId} state={state} name="sequence" label="Position (optional)" type="number" step={1} min={0} initial={sequence} /><button disabled={pending} type="submit">Save City position</button></form>
    <DeleteForm action={removeTripCity.bind(null, tripId, city.id)} label="Remove City from Trip" explanation="The City record is kept. Removal is blocked while a Location or Stay in this Trip uses the City." />
  </article>;
}
export function AddTripLocation({ tripId, locations }: { tripId: string; locations: Location[] }) {
  const formId = 'add-trip-location';
  const [state, action, pending] = useActionState(setTripLocation.bind(null, tripId), emptyFormState);
  return <div className="panel">
    {locations.length ? <form id={formId} action={action}>
      <Feedback state={state} />
      <div className="field"><label htmlFor={`${formId}-location`}>Location (required)</label><select id={`${formId}-location`} name="location_id" required defaultValue={state.values?.location_id ?? ''}><option value="">Select a Location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name} ({location.slug})</option>)}</select><span className="field-error">{state.errors?.location_id}</span></div>
      <Field formId={formId} state={state} name="sequence" label="Position in Trip (optional)" type="number" step={1} min={0} />
      <Field formId={formId} state={state} name="visited_at" label="Visit date (optional)" type="date" />
      <button disabled={pending} type="submit">{pending ? 'Saving…' : 'Add Location to Trip'}</button>
    </form> : <p>No unassociated Locations are available.</p>}
    <p><Link href={`/admin/locations/new?trip=${tripId}`}>Create a Location for this Trip</Link></p>
    <p className="hint">Adding a Location also includes its City. Dates and order can remain unknown.</p>
  </div>;
}
export function TripLocationRow({ tripId, location, cityName, sequence, visitedAt }: { tripId: string; location: Location; cityName: string; sequence: number | null; visitedAt: string | null }) {
  const formId = `location-${location.id}`;
  const [state, action, pending] = useActionState(setTripLocation.bind(null, tripId), emptyFormState);
  return <article className="panel"><h3><Link href={`/admin/locations/${location.id}?trip=${tripId}`}>{location.name}</Link></h3><p>{cityName} · {location.status === 'published' ? 'Published' : 'Draft'}</p>
    <form id={formId} action={action}><Feedback state={state} /><input type="hidden" name="location_id" value={location.id} />
      <div className="field-pair"><Field formId={formId} state={state} name="sequence" label="Position (optional)" type="number" step={1} min={0} initial={sequence} /><Field formId={formId} state={state} name="visited_at" label="Visit date (optional)" type="date" initial={visitedAt} /></div>
      <button disabled={pending} type="submit">Save Location association</button>
    </form>
    <DeleteForm action={removeTripLocation.bind(null, tripId, location.id)} label="Remove Location from Trip" explanation="This removes only the association. The Location and City records are kept. Photos using this association block removal." />
  </article>;
}
