'use client';
import { useActionState, useState } from 'react';
import { saveHotel } from '@/app/admin/(protected)/stay-actions';
import type { Hotel, CityOption, Country } from '@/lib/admin/catalog';
import { emptyFormState } from '@/lib/admin/form-state';
import { slugify } from '@/lib/validation/content';
import { CityChoice } from './city-choice';
import { DescriptionField, Feedback, Field, StatusField } from './form-fields';
export function HotelForm({ hotel, cities, countries, covers = [] }: {
    hotel?: Hotel;
    cities: CityOption[];
    countries: Country[];
    covers?: {id:string;filename:string;caption:string|null}[];
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
 <Field formId={formId} state={state} name="rating" label="Current rating (optional, whole stars 1–5)" type="number" min={1} max={5} step={1} initial={hotel?.rating}/>
 <fieldset><legend>Personally recommended for (optional)</legend>{(['family', 'business', 'leisure'] as const).map(category => { const name = `recommended_${category}` as const; return <label key={name} className="checkbox"><input type="checkbox" name={name} value="yes" defaultChecked={state.values ? state.values[name] === 'yes' : hotel?.[name] ?? false}/>{category === 'leisure' ? 'Personal / Leisure' : category === 'family' ? 'Family' : 'Business'}</label>; })}</fieldset>
 <div className="field"><label htmlFor="hotel-review">Current public review (optional)</label><textarea id="hotel-review" name="review_text" rows={6} maxLength={20000} defaultValue={state.values?.review_text ?? hotel?.review_text ?? ''}/><span className="field-error">{state.errors?.review_text}</span></div>
 <div className="field"><label htmlFor="hotel-cover">Cover photograph (optional)</label><select id="hotel-cover" name="cover_photo_id" defaultValue={state.values?.cover_photo_id ?? hotel?.cover_photo_id ?? ''}><option value="">Automatic eligible Nice photograph</option>{covers.map(photo=><option key={photo.id} value={photo.id}>{photo.caption || photo.filename}</option>)}{hotel?.cover_photo_id && !covers.some(p=>p.id===hotel.cover_photo_id) && <option value={hotel.cover_photo_id}>Previous cover (currently ineligible; choose automatic or another photo)</option>}</select><span className="field-error">{state.errors?.cover_photo_id}</span></div>
 <Field formId={formId} state={state} name="editorial_order" label="Display position (optional)" type="number" min={0} step={1} initial={hotel?.editorial_order}/></form>
 <CityChoice formId={formId} cities={cities} countries={countries} value={cityId} onChange={setCityId} state={state}/>
 <p className="hint">Hotel identity persists across visits. It is separate from Locations. Rating and review are your current opinion. Cover photography uses a Published Nice photo assigned to this Hotel. Featured is edited on the Photo.</p>
 <button form={formId} disabled={pending}>{pending ? 'Saving…' : hotel ? 'Save Hotel' : 'Create Hotel'}</button></div>;
}
