'use client';

import { useActionState, useState } from 'react';
import { saveTrip } from '@/app/admin/(protected)/content-actions';
import { emptyFormState } from '@/lib/admin/form-state';
import type { Trip } from '@/lib/admin/catalog';
import { slugify } from '@/lib/validation/content';
import { Feedback, Field, DescriptionField, StatusField } from './form-fields';

export function TripForm({ trip }: { trip?: Trip }) {
  const formId = 'trip-editor';
  const [state, action, pending] = useActionState(saveTrip.bind(null, trip?.id ?? null), emptyFormState);
  const [slug, setSlug] = useState(trip?.slug ?? '');
  const [autoSlug, setAutoSlug] = useState(!trip);
  return <form id={formId} action={action} className="editor">
    <Feedback state={state} />
    <Field formId={formId} state={state} name="title" label="Title (required)" required maxLength={200} initial={trip?.title} onChange={(event) => { if (autoSlug) setSlug(slugify(event.target.value)); }} />
    <Field formId={formId} state={state} name="slug" label="URL name (required)" required maxLength={200} value={slug} onChange={(event) => { setAutoSlug(false); setSlug(event.target.value); }} />
    <p className="hint">Suggested from the title. Changing an existing URL name changes its future public address.</p>
    <StatusField formId={formId} state={state} initial={trip?.status} />
    <div className="field-pair"><Field formId={formId} state={state} name="start_date" label="Start date (optional)" type="date" initial={trip?.start_date} /><Field formId={formId} state={state} name="end_date" label="End date (optional)" type="date" initial={trip?.end_date} /></div>
    <p className="hint">Unknown dates can stay empty. One known endpoint is valid.</p>
    <div className="field"><label htmlFor={`${formId}-purpose`}>Purpose (optional)</label><select id={`${formId}-purpose`} name="purpose" defaultValue={state.values?.purpose ?? trip?.purpose ?? ''}><option value="">Not specified</option><option value="leisure">Leisure</option><option value="business">Business</option><option value="family">Family</option><option value="photography">Photography</option><option value="mixed">Mixed</option></select><span className="field-error">{state.errors?.purpose}</span></div>
    <DescriptionField formId={formId} state={state} initial={trip?.description} />
    <Field formId={formId} state={state} name="editorial_order" label="Display position (optional)" type="number" step={1} min={0} initial={trip?.editorial_order} />
    <p className="hint">Cover selection will be available after photo importing. Any existing cover is preserved.</p>
    <button disabled={pending} type="submit">{pending ? 'Saving…' : trip ? 'Save Trip' : 'Create Trip'}</button>
  </form>;
}
