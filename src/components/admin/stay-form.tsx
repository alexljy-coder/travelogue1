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
 <div className="field"><label htmlFor="stay-trip">Trip (optional for Singapore Hotels)</label><select id="stay-trip" name="trip_id" defaultValue={state.values?.trip_id ?? stay?.trip_id ?? tripId ?? ''}><option value="">Not assigned</option>{trips.map(t => <option key={t.id} value={t.id}>{t.title} · {t.status}</option>)}</select><span className="field-error">{state.errors?.trip_id}</span></div>
 <StatusField formId={formId} state={state} initial={stay?.status}/><p className="hint">Publishing requires a Published Hotel and any assigned Trip. A Trip is required outside Singapore. Dates are optional.</p>
 <div className="field-pair"><Field formId={formId} state={state} name="check_in" label="Check-in (optional)" type="date" initial={stay?.check_in}/><Field formId={formId} state={state} name="check_out" label="Check-out (optional)" type="date" initial={stay?.check_out}/></div>
 <div className="field"><label htmlFor="stay-notes">Private visit note (optional; never public)</label><textarea id="stay-notes" name="internal_notes" rows={3} maxLength={20000} defaultValue={state.values?.internal_notes ?? stay?.internal_notes ?? ''}/><span className="field-error">{state.errors?.internal_notes}</span></div>
 <input type="hidden" name="editorial_order" value={stay?.editorial_order ?? ''}/>
 <p className="hint">Rating, review and photographs belong to the Hotel. Recording a visit does not require them.</p>
 <button disabled={pending}>{pending ? 'Saving…' : stay ? 'Save Stay' : 'Create Stay'}</button></form>;
}
