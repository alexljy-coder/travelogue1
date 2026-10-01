'use client';

import { useActionState, useState } from 'react';
import { saveLocation } from '@/app/admin/(protected)/content-actions';
import type { CityOption, Country, Location } from '@/lib/admin/catalog';
import { emptyFormState } from '@/lib/admin/form-state';
import { slugify } from '@/lib/validation/content';
import { CityChoice } from './city-choice';
import { DescriptionField, Feedback, Field, StatusField } from './form-fields';

export function LocationForm({ location, cities, countries, tripId }: { location?: Location; cities: CityOption[]; countries: Country[]; tripId?: string }) {
  const formId = 'location-editor';
  const [state, action, pending] = useActionState(saveLocation.bind(null, location?.id ?? null, tripId ?? null), emptyFormState);
  const [cityId, setCityId] = useState(location?.city_id ?? '');
  const [slug, setSlug] = useState(location?.slug ?? '');
  const [autoSlug, setAutoSlug] = useState(!location);
  return <div className="editor">
    <form id={formId} action={action}>
      <Feedback state={state} />
      <Field formId={formId} state={state} name="name" label="Location name (required)" required maxLength={200} initial={location?.name} onChange={(event) => { if (autoSlug) setSlug(slugify(event.target.value)); }} />
      <Field formId={formId} state={state} name="slug" label="URL name (required)" required maxLength={200} value={slug} onChange={(event) => { setAutoSlug(false); setSlug(event.target.value); }} />
      <StatusField formId={formId} state={state} initial={location?.status} />
      <DescriptionField formId={formId} state={state} initial={location?.description} />
      <div className="field-pair"><Field formId={formId} state={state} name="latitude" label="Latitude (optional)" type="number" step="any" min={-90} max={90} initial={location?.latitude} /><Field formId={formId} state={state} name="longitude" label="Longitude (optional)" type="number" step="any" min={-180} max={180} initial={location?.longitude} /></div>
      <p className="hint">Enter a representative point manually, or leave both coordinates empty.</p>
      <Field formId={formId} state={state} name="editorial_order" label="Display position (optional)" type="number" min={0} step={1} initial={location?.editorial_order} />
    </form>
    <CityChoice formId={formId} cities={cities} countries={countries} value={cityId} onChange={setCityId} state={state} />
    <p className="hint">A Location is a destination, not a Hotel. Cover selection is deferred; any existing cover is preserved.</p>
    <button form={formId} disabled={pending} type="submit">{pending ? 'Saving…' : location ? 'Save Location' : tripId ? 'Create Location and add to Trip' : 'Create Location'}</button>
  </div>;
}
