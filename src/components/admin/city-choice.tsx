'use client';

import { useActionState, useId, useState } from 'react';
import { createCity, type GeographyState } from '@/app/admin/(protected)/content-actions';
import type { CityOption, Country } from '@/lib/admin/catalog';
import { slugify } from '@/lib/validation/content';
import { Feedback, Field } from './form-fields';
import type { FormState } from '@/lib/admin/form-state';

export function CityChoice({ formId, cities: initialCities, countries: initialCountries, value, onChange, state }: {
  formId: string; cities: CityOption[]; countries: Country[]; value: string;
  onChange: (id: string) => void; state: FormState;
}) {
  const [createdCities, setCities] = useState<CityOption[]>([]);
  const [createdCountries, setCountries] = useState<Country[]>([]);
  const cities = [...new Map([...createdCities, ...initialCities].map((city) => [city.id, city])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const countries = [...new Map([...createdCountries, ...initialCountries].map((country) => [country.id, country])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const id = `${formId}-city_id`;
  return <section className="city-choice">
    <div className="field"><label htmlFor={id}>City (required)</label><select form={formId} id={id} name="city_id" required value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={!!state.errors?.city_id} aria-describedby={`${id}-error`}>
      <option value="">Select a City</option>
      {cities.map((city) => <option key={city.id} value={city.id}>{city.name} · {city.country_name} ({city.slug})</option>)}
    </select><span id={`${id}-error`} className="field-error">{state.errors?.city_id}</span></div>
    {!cities.length && <p>No Cities yet. Create one below.</p>}
    <details><summary>Create a City</summary><CityCreator countries={countries} onCreated={(city, country) => {
      setCities((current) => [...current.filter((item) => item.id !== city.id), city].sort((a, b) => a.name.localeCompare(b.name)));
      setCountries((current) => [...current.filter((item) => item.id !== country.id), country].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(city.id);
    }} /></details>
  </section>;
}

function CityCreator({ countries, onCreated }: { countries: Country[]; onCreated: (city: CityOption, country: Country) => void }) {
  const formId = useId();
  const [countryId, setCountryId] = useState(countries.length ? '' : 'new');
  const [slug, setSlug] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);
  const [countrySlug, setCountrySlug] = useState('');
  const [autoCountrySlug, setAutoCountrySlug] = useState(true);
  const [state, action, pending] = useActionState(async (previous: GeographyState, form: FormData) => {
    const result = await createCity(previous, form);
    if (result.city && result.country) {
      onCreated(result.city, result.country);
      setCountryId(result.country.id);
      setSlug('');
      setCountrySlug('');
      setAutoSlug(true);
      setAutoCountrySlug(true);
    }
    return result;
  }, {});
  return <form id={formId} action={action} className="panel">
    <Feedback state={state} />
    <Field formId={formId} state={state} name="name" label="City name (required)" required maxLength={200} onChange={(event) => { if (autoSlug) setSlug(slugify(event.target.value)); }} />
    <Field formId={formId} state={state} name="slug" label="City URL name (required)" value={slug} required maxLength={200} onChange={(event) => { setAutoSlug(false); setSlug(event.target.value); }} />
    <p className="hint">Suggested from the name. Edit it to distinguish different Cities with the same name.</p>
    <div className="field"><label htmlFor={`${formId}-country`}>Country (required)</label><select id={`${formId}-country`} name="country_id" required value={countryId} onChange={(event) => setCountryId(event.target.value)}>
      <option value="">Select a Country</option>{countries.map((country) => <option key={country.id} value={country.id}>{country.name} ({country.code})</option>)}<option value="new">Create a new Country</option>
    </select><span className="field-error">{state.errors?.country_id}</span></div>
    {countryId === 'new' && <fieldset><legend>New Country</legend>
      <Field formId={formId} state={state} name="country_name" label="Country name (required)" required maxLength={200} onChange={(event) => { if (autoCountrySlug) setCountrySlug(slugify(event.target.value)); }} />
      <Field formId={formId} state={state} name="country_code" label="Two-letter Country code (required)" required minLength={2} maxLength={2} placeholder="CN" />
      <Field formId={formId} state={state} name="country_slug" label="Country URL name (required)" required value={countrySlug} onChange={(event) => { setAutoCountrySlug(false); setCountrySlug(event.target.value); }} />
    </fieldset>}
    <div className="field-pair"><Field formId={formId} state={state} name="latitude" label="City latitude (optional)" type="number" step="any" min={-90} max={90} /><Field formId={formId} state={state} name="longitude" label="City longitude (optional)" type="number" step="any" min={-180} max={180} /></div>
    <p className="hint">Representative point only. Leave both coordinates empty if unknown. Matching identities are reused; existing coordinates are preserved.</p>
    <button disabled={pending} type="submit">{pending ? 'Saving City…' : 'Create or select City'}</button>
  </form>;
}
