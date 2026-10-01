'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { citySchema, locationSchema, slugify, tripCitySchema, tripLocationSchema, tripSchema, uuidSchema } from '@/lib/validation/content';
import { databaseError, validationState, valuesFor, type FormState } from '@/lib/admin/form-state';
import type { CityOption, Country } from '@/lib/admin/catalog';

function refresh(tripId?: string) {
  revalidatePath('/admin');
  revalidatePath('/admin/trips', 'layout');
  revalidatePath('/admin/locations', 'layout');
  if (tripId) revalidatePath(`/admin/trips/${tripId}`);
}
const invalidId = (values: Record<string, string>): FormState => ({ error: 'This record identifier is invalid. Reload the page.', values });

export async function saveTrip(id: string | null, _previous: FormState, form: FormData): Promise<FormState> {
  const { client } = await requireAdmin();
  const values = valuesFor(form, ['title', 'slug', 'start_date', 'end_date', 'purpose', 'description', 'status', 'editorial_order']);
  if (id && !uuidSchema.safeParse(id).success) return invalidId(values);
  values.slug ||= slugify(values.title);
  const result = tripSchema.safeParse(values);
  if (!result.success) return validationState(values, result.error.issues);
  const query = id ? client.from('trips').update(result.data).eq('id', id) : client.from('trips').insert(result.data);
  const { data, error } = await query.select('id').single();
  if (error) return { error: databaseError(error), values };
  refresh(data.id);
  if (!id) redirect(`/admin/trips/${data.id}?saved=1`);
  return { message: 'Trip saved.', values };
}

export async function deleteTrip(id: string, _previous: FormState, form: FormData): Promise<FormState> {
  const { client } = await requireAdmin();
  if (!uuidSchema.safeParse(id).success) return invalidId({});
  if (form.get('confirm') !== 'yes') return { error: 'Confirm deletion before continuing.' };
  const { error } = await client.rpc('admin_delete_trip', { p_trip_id: id });
  if (error) return { error: databaseError(error) };
  refresh();
  redirect('/admin/trips?deleted=1');
}

export async function saveLocation(id: string | null, tripId: string | null, _previous: FormState, form: FormData): Promise<FormState> {
  const { client } = await requireAdmin();
  const values = valuesFor(form, ['name', 'slug', 'city_id', 'latitude', 'longitude', 'description', 'status', 'editorial_order']);
  if ((id && !uuidSchema.safeParse(id).success) || (tripId && !uuidSchema.safeParse(tripId).success)) return invalidId(values);
  values.slug ||= slugify(values.name);
  const result = locationSchema.safeParse(values);
  if (!result.success) return validationState(values, result.error.issues);
  const record = result.data;
  const { data, error } = await client.rpc('admin_save_location', {
    p_id: id, p_city_id: record.city_id, p_name: record.name, p_slug: record.slug,
    p_latitude: record.latitude, p_longitude: record.longitude, p_description: record.description,
    p_status: record.status, p_editorial_order: record.editorial_order, p_trip_id: !id ? tripId : null,
  });
  if (error) return { error: databaseError(error), values };
  refresh(tripId ?? undefined);
  if (!id) redirect(tripId ? `/admin/trips/${tripId}?locationAdded=1` : `/admin/locations/${data}?saved=1`);
  return { message: 'Location saved. Its City is included in every associated Trip.', values };
}

export async function deleteLocation(id: string, _previous: FormState, form: FormData): Promise<FormState> {
  const { client } = await requireAdmin();
  if (!uuidSchema.safeParse(id).success) return invalidId({});
  if (form.get('confirm') !== 'yes') return { error: 'Confirm deletion before continuing.' };
  const { data, error } = await client.from('locations').delete().eq('id', id).select('id').single();
  if (error || !data) return { error: error ? databaseError(error) : 'This Location no longer exists.' };
  refresh();
  redirect('/admin/locations?deleted=1');
}

export type GeographyState = FormState & { city?: CityOption; country?: Country };
export async function createCity(_previous: GeographyState, form: FormData): Promise<GeographyState> {
  const { client } = await requireAdmin();
  const values = valuesFor(form, ['name', 'slug', 'country_id', 'latitude', 'longitude', 'country_name', 'country_code', 'country_slug']);
  values.slug ||= slugify(values.name);
  values.country_slug ||= slugify(values.country_name);
  const result = citySchema.safeParse(values);
  if (!result.success) return validationState(values, result.error.issues);
  const record = result.data;
  const { data: cityId, error } = await client.rpc('admin_create_city', {
    p_name: record.name, p_slug: record.slug, p_country_id: record.country_id === 'new' ? null : record.country_id,
    p_country_name: record.country_id === 'new' ? record.country_name : null,
    p_country_code: record.country_id === 'new' ? record.country_code : null,
    p_country_slug: record.country_id === 'new' ? record.country_slug : null,
    p_latitude: record.latitude, p_longitude: record.longitude,
  });
  if (error) return { error: databaseError(error), values };
  const { data: city, error: cityError } = await client.from('cities').select('*').eq('id', cityId!).single();
  if (cityError || !city) return { error: 'City saved, but the selector could not reload. Refresh this page.', values };
  const { data: country, error: countryError } = await client.from('countries').select('*').eq('id', city.country_id).single();
  if (countryError || !country) return { error: 'City saved, but the selector could not reload. Refresh this page.', values };
  refresh();
  return { message: 'City ready and selected above. Save or add it to the current record to finish.', city: { ...city, country_name: country.name }, country };
}

export async function setTripCity(tripId: string, _previous: FormState, form: FormData): Promise<FormState> {
  const { client } = await requireAdmin();
  const values = valuesFor(form, ['city_id', 'sequence']);
  if (!uuidSchema.safeParse(tripId).success) return invalidId(values);
  const result = tripCitySchema.safeParse(values);
  if (!result.success) return validationState(values, result.error.issues);
  const { error } = await client.rpc('admin_set_trip_city', { p_trip_id: tripId, p_city_id: result.data.city_id, p_sequence: result.data.sequence });
  if (error) return { error: databaseError(error), values };
  refresh(tripId);
  return { message: 'City association saved.', values };
}

export async function removeTripCity(tripId: string, cityId: string, _previous: FormState, form: FormData): Promise<FormState> {
  const { client } = await requireAdmin();
  if (!uuidSchema.safeParse(tripId).success || !uuidSchema.safeParse(cityId).success) return invalidId({});
  if (form.get('confirm') !== 'yes') return { error: 'Confirm removal before continuing.' };
  const { error } = await client.rpc('admin_remove_trip_city', { p_trip_id: tripId, p_city_id: cityId });
  if (error) return { error: databaseError(error) };
  refresh(tripId);
  return { message: 'City removed from this Trip. The City record is preserved.' };
}

export async function setTripLocation(tripId: string, _previous: FormState, form: FormData): Promise<FormState> {
  const { client } = await requireAdmin();
  const values = valuesFor(form, ['location_id', 'sequence', 'visited_at']);
  if (!uuidSchema.safeParse(tripId).success) return invalidId(values);
  const result = tripLocationSchema.safeParse(values);
  if (!result.success) return validationState(values, result.error.issues);
  const { error } = await client.rpc('admin_set_trip_location', {
    p_trip_id: tripId, p_location_id: result.data.location_id, p_sequence: result.data.sequence, p_visited_at: result.data.visited_at,
  });
  if (error) return { error: databaseError(error), values };
  refresh(tripId);
  return { message: 'Location association saved. Its City is also included.', values };
}

export async function removeTripLocation(tripId: string, locationId: string, _previous: FormState, form: FormData): Promise<FormState> {
  const { client } = await requireAdmin();
  if (!uuidSchema.safeParse(tripId).success || !uuidSchema.safeParse(locationId).success) return invalidId({});
  if (form.get('confirm') !== 'yes') return { error: 'Confirm removal before continuing.' };
  const { error } = await client.rpc('admin_remove_trip_location', { p_trip_id: tripId, p_location_id: locationId });
  if (error) return { error: databaseError(error) };
  refresh(tripId);
  return { message: 'Location removed from this Trip. Location and City records are preserved.' };
}
