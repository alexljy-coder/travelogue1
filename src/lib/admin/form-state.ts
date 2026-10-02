export type FormValues = Record<string, string>;
export type FormState = { error?: string; message?: string; errors?: Record<string, string>; values?: FormValues };
export const emptyFormState: FormState = {};

export function formValues(form: FormData): FormValues {
  const values: FormValues = {};
  for (const [key, value] of form.entries()) if (typeof value === 'string' && !key.startsWith('$ACTION_')) values[key] = value;
  return values;
}
export function valuesFor(form: FormData, fields: string[]): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    const value = form.get(field);
    values[field] = typeof value === 'string' ? value : '';
  }
  return values;
}
export function validationState(values: FormValues, issues: readonly { path: PropertyKey[]; message: string }[]): FormState {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[String(issue.path[0])] ??= issue.message;
  return { error: 'Please correct the fields below.', errors, values };
}

const workflowMessages = new Set([
  'A Trip is required for a Stay outside Singapore.', 'A Trip is required for photography outside Singapore.', 'Assign a Trip to dependent home records before moving their geography outside Singapore.',
  'Select an existing City.', 'Select an existing Hotel.', 'Select an existing Trip.', 'Select an existing Stay.',
  'This Hotel no longer exists.', 'This Stay no longer exists.', 'A published Trip and Hotel are required.',
  'This Hotel already exists in this City. Select the existing Hotel.',
  'Select an existing Country.',
  'This Country code already exists. Select the existing Country.',
  'This Country name already exists. Select the existing Country.',
  'This City URL name already exists. Select the existing City or use another URL name.',
  'This Trip no longer exists.', 'This Location no longer exists.', 'Select an existing Location.',
  'This City is used by a Location or Stay in the Trip. Remove those associations first.',
  'This Trip has Photos or Stays. Keep it, or unpublish it instead.',
]);
export function databaseError(error: { code?: string; message?: string }): string {
  if (error.message && workflowMessages.has(error.message)) return error.message;
  if (error.code === '23505') return 'This URL name or Country code is already used. Select the existing record or choose another URL name.';
  if (error.code === '23503' || error.code === '23001') return 'This record or association is still referenced. Remove its dependencies first, or keep it unpublished.';
  if (error.code === '23514' || error.code === '23502' || error.code === '22007' || error.code === '22008') return 'Some values are invalid. Check required fields, dates and coordinates.';
  if (error.code === '42501') return 'Administrator access is required. Sign in again.';
  if (error.code === '42883' || error.code === 'PGRST202') return 'The content workflow migration has not been applied. Ask the project owner to complete setup.';
  if (error.code === 'P0001' && error.message && workflowMessages.has(error.message)) return error.message;
  return 'Unable to save this change. Try again; your entered values are preserved.';
}
