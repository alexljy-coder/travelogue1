'use client';

import type { InputHTMLAttributes } from 'react';
import type { FormState } from '@/lib/admin/form-state';

export function Feedback({ state }: { state: FormState }) {
  return <>{state.error && <p className="error" role="alert">{state.error}</p>}{state.message && <p className="success" role="status">{state.message}</p>}</>;
}
export function Field({ name, label, state, formId, initial = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { name: string; label: string; state: FormState; formId: string; initial?: string | number | null }) {
  const id = `${formId}-${name}`;
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <input {...props} id={id} name={name} defaultValue={props.value === undefined ? state.values?.[name] ?? initial ?? '' : undefined} aria-invalid={!!state.errors?.[name]} aria-describedby={`${id}-error`} />
    <span id={`${id}-error`} className="field-error">{state.errors?.[name]}</span>
  </div>;
}
export function StatusField({ formId, state, initial }: { formId: string; state: FormState; initial?: string }) {
  const id = `${formId}-status`;
  return <div className="field"><label htmlFor={id}>Status (required)</label><select id={id} name="status" required defaultValue={state.values?.status ?? initial ?? 'draft'}><option value="draft">Draft</option><option value="published">Published</option></select><span className="field-error">{state.errors?.status}</span></div>;
}
export function DescriptionField({ formId, state, initial }: { formId: string; state: FormState; initial?: string | null }) {
  const id = `${formId}-description`;
  return <div className="field"><label htmlFor={id}>Description (optional)</label><textarea id={id} name="description" rows={5} maxLength={20000} defaultValue={state.values?.description ?? initial ?? ''} aria-invalid={!!state.errors?.description} /><span className="field-error">{state.errors?.description}</span></div>;
}
