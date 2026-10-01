'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { saveStay } from '@/app/admin/(protected)/stay-actions';
import type { Stay, Hotel, Trip } from '@/lib/admin/catalog';
import { emptyFormState } from '@/lib/admin/form-state';
import { Feedback, Field, StatusField } from './form-fields';
export function StayForm({ stay, hotels, trips, hotelId, tripId }: {
    stay?: Stay;
    hotels: Hotel[];
    trips: Trip[];
    hotelId?: string;
    tripId?: string;
}) {
    const formId = 'stay-editor';
    const [state, action, pending] = useActionState(saveStay.bind(null, stay?.id ?? null), emptyFormState);
    return <form id={formId} action={action} className="editor"><Feedback state={state}/>
 <div className="field"><label htmlFor="stay-hotel">Hotel (required)</label><select id="stay-hotel" name="hotel_id" required defaultValue={state.values?.hotel_id ?? stay?.hotel_id ?? hotelId ?? ''}><option value="">Choose Hotel</option>{hotels.map(h => <option key={h.id} value={h.id}>{h.name} · {h.status}</option>)}</select><span className="field-error">{state.errors?.hotel_id}</span><Link href="/admin/hotels/new">Create a Hotel</Link></div>
 <div className="field"><label htmlFor="stay-trip">Trip (required)</label><select id="stay-trip" name="trip_id" required defaultValue={state.values?.trip_id ?? stay?.trip_id ?? tripId ?? ''}><option value="">Choose Trip</option>{trips.map(t => <option key={t.id} value={t.id}>{t.title} · {t.status}</option>)}</select><span className="field-error">{state.errors?.trip_id}</span></div>
 <StatusField formId={formId} state={state} initial={stay?.status}/><p className="hint">Publishing requires a Published Hotel and Trip. Dates and review are optional.</p>
 <div className="field-pair"><Field formId={formId} state={state} name="check_in" label="Check-in (optional)" type="date" initial={stay?.check_in}/><Field formId={formId} state={state} name="check_out" label="Check-out (optional)" type="date" initial={stay?.check_out}/></div>
 <Field formId={formId} state={state} name="room_type" label="Room type (optional)" initial={stay?.room_type}/>
 <div className="field"><label htmlFor="stay-purpose">Purpose (optional)</label><select id="stay-purpose" name="purpose" defaultValue={state.values?.purpose ?? stay?.purpose ?? ''}><option value="">Not recorded</option>{['business', 'leisure', 'family', 'mixed'].map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</select><span className="field-error">{state.errors?.purpose}</span></div>
 <Field formId={formId} state={state} name="rating" label="This Stay's rating (optional, whole stars 1–5)" type="number" min={1} max={5} step={1} initial={stay?.rating}/>
 {(['review_text', 'internal_notes'] as const).map(name => <div className="field" key={name}><label htmlFor={`stay-${name}`}>{name === 'review_text' ? 'Public review / editorial text (optional)' : 'Private internal notes (optional; never public)'}</label><textarea id={`stay-${name}`} name={name} rows={6} maxLength={20000} defaultValue={state.values?.[name] ?? stay?.[name] ?? ''}/><span className="field-error">{state.errors?.[name]}</span></div>)}
 <p className="hint">Family, Business and Personal / Leisure recommendations belong to the Hotel and can be edited on its page.</p>
 <Field formId={formId} state={state} name="editorial_order" label="Display position (optional)" type="number" min={0} step={1} initial={stay?.editorial_order}/>
 <button disabled={pending}>{pending ? 'Saving…' : stay ? 'Save Stay' : 'Create Stay'}</button></form>;
}
