'use client';
import { useActionState, useState } from 'react';
import { saveHotel } from '@/app/admin/(protected)/stay-actions';
import type { Hotel, CityOption, Country } from '@/lib/admin/catalog';
import { emptyFormState } from '@/lib/admin/form-state';
import { slugify } from '@/lib/validation/content';
import { CityChoice } from './city-choice';
import { DescriptionField, Feedback, Field, StatusField } from './form-fields';
export function HotelForm({ hotel, cities, countries }: {
    hotel?: Hotel;
    cities: CityOption[];
    countries: Country[];
}) {
    const formId = 'hotel-editor';
    const [state, action, pending] = useActionState(saveHotel.bind(null, hotel?.id ?? null), emptyFormState);
    const [cityId, setCityId] = useState(hotel?.city_id ?? '');
    const [slug, setSlug] = useState(hotel?.slug ?? '');
    const [auto, setAuto] = useState(!hotel);
    return <div className="editor"><form id={formId} action={action}><Feedback state={state}/>
 <Field formId={formId} state={state} name="name" label="Hotel name (required)" required maxLength={200} initial={hotel?.name} onChange={e => { if (auto)
        setSlug(slugify(e.target.value)); }}/>
 <Field formId={formId} state={state} name="slug" label="URL name (required)" required value={slug} onChange={e => { setAuto(false); setSlug(e.target.value); }}/>
 <StatusField formId={formId} state={state} initial={hotel?.status}/>
 <Field formId={formId} state={state} name="brand" label="Brand (optional)" initial={hotel?.brand}/><Field formId={formId} state={state} name="address" label="Address (optional)" initial={hotel?.address}/>
 <DescriptionField formId={formId} state={state} initial={hotel?.description}/>
 <div className="field-pair"><Field formId={formId} state={state} name="latitude" label="Latitude (optional)" type="number" step="any" min={-90} max={90} initial={hotel?.latitude}/><Field formId={formId} state={state} name="longitude" label="Longitude (optional)" type="number" step="any" min={-180} max={180} initial={hotel?.longitude}/></div>
 <Field formId={formId} state={state} name="rating" label="General rating (optional, whole stars 1–5)" type="number" min={1} max={5} step={1} initial={hotel?.rating}/>
 <fieldset><legend>Personally recommended for (optional)</legend>{(['family', 'business', 'leisure'] as const).map(category => { const name = `recommended_${category}` as const; return <label key={name} className="checkbox"><input type="checkbox" name={name} value="yes" defaultChecked={state.values ? state.values[name] === 'yes' : hotel?.[name] ?? false}/>{category === 'leisure' ? 'Personal / Leisure' : category === 'family' ? 'Family' : 'Business'}</label>; })}</fieldset>
 <Field formId={formId} state={state} name="editorial_order" label="Display position (optional)" type="number" min={0} step={1} initial={hotel?.editorial_order}/></form>
 <CityChoice formId={formId} cities={cities} countries={countries} value={cityId} onChange={setCityId} state={state}/>
 <p className="hint">Hotel identity persists across visits. It is separate from Locations. Cover photography uses a valid Nice Hotel photo from a published Stay.</p>
 <button form={formId} disabled={pending}>{pending ? 'Saving…' : hotel ? 'Save Hotel' : 'Create Hotel'}</button></div>;
}
