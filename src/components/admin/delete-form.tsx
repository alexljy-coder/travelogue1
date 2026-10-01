'use client';

import { useActionState, useId } from 'react';
import type { FormState } from '@/lib/admin/form-state';
import { Feedback } from './form-fields';

export function DeleteForm({ action, label, explanation, blocked }: { action: (previous: FormState, form: FormData) => Promise<FormState>; label: string; explanation: string; blocked?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  const id = useId();
  return <details className="danger-zone"><summary>{label}</summary><p>{explanation}</p>{blocked ? <p>{blocked}</p> : <form action={formAction}>
    <Feedback state={state} />
    <label className="checkbox" htmlFor={id}><input id={id} type="checkbox" name="confirm" value="yes" required />I confirm: {label.toLowerCase()}.</label>
    <button className="danger" type="submit" disabled={pending}>{pending ? 'Removing…' : label}</button>
  </form>}</details>;
}
