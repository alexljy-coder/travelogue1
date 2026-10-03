'use server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { photoEditSchema } from '@/lib/validation/photo';
import { uuidSchema } from '@/lib/validation/content';
import { photoPublicationErrors, type PhotoParents, type PublicationStatus } from '@/lib/validation/publishing';
import { valuesFor, validationState, databaseError, type FormState } from '@/lib/admin/form-state';
import { createIngestion, PhotoWorkflowError } from '@/lib/photos/ingestion';
import { createImportRepository } from '@/lib/photos/repository';
import { createR2Storage } from '@/lib/r2/storage';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function savePhoto(id: string, _previous: FormState, form: FormData): Promise<FormState> {
  const { client } = await requireAdmin();
  const values = valuesFor(form, ['context','hotel_id','classification','status','featured','trip_id','location_id','caption','description','editorial_order']);
  if (!uuidSchema.safeParse(id).success) return { error: 'Invalid Photo identifier.', values };
  const result = photoEditSchema.safeParse(values);
  if (!result.success) return validationState(values, result.error.issues);
  const { data: photo, error: photoError } = await client.from('photos').select('*').eq('id', id).single();
  if (photoError || !photo || photo.processing_status !== 'ready') return { error: 'Only a ready photo can be edited. Check import or deletion status.', values };
  const record = result.data;
  const parents: PhotoParents = {};
  if (record.trip_id) {
    const { data, error } = await client.from('trips').select('id,status').eq('id', record.trip_id).maybeSingle();
    if (error) return { error: 'Unable to verify the Trip. Try again.', values };
    if (data) parents.trip = { ...data, status: data.status as PublicationStatus };
    else return { error: 'The selected Trip no longer exists.', values };
  }
  if (record.location_id) {
    const { data, error } = await client.from('locations').select('id,status,city_id').eq('id', record.location_id).maybeSingle();
    if (error) return { error: 'Unable to verify the Location. Try again.', values };
    if (data) {
      const home = await client.rpc('city_is_singapore', {p_city_id:data.city_id});
      if (home.error) return {error:'Unable to verify Location geography.',values};
      parents.location = { ...data, status: data.status as PublicationStatus, country_code:home.data ? 'SG' : undefined };
    }
    else return { error: 'The selected Location no longer exists.', values };
  }
  if (record.trip_id && record.location_id) {
    const { data, error } = await client.from('trip_locations').select('trip_id').eq('trip_id', record.trip_id).eq('location_id', record.location_id).maybeSingle();
    if (error) return { error: 'Unable to verify Trip–Location membership.', values };
    parents.tripLocationAssociated = !!data;
    if (!data) return { error: 'Add this Location to the selected Trip first, or leave the assignment incomplete as Draft.', values };
  }
  if (record.hotel_id) {
    const {data,error} = await client.from('hotels').select('id,status').eq('id',record.hotel_id).maybeSingle();
    if(error || !data) return {error:'Unable to verify the selected Hotel.',values};
    parents.hotel={id:data.id,status:data.status as PublicationStatus};
  }
  const errors = photoPublicationErrors({ ...photo, ...record, context: record.context, processing_status: 'ready' }, parents);
  if (errors.length) return { error: errors.join(' '), values };
  const { error } = await client.from('photos').update(record).eq('id', id).eq('processing_status','ready').select('id').single();
  if (error) return { error: databaseError(error), values };
  revalidatePath('/admin/photos', 'layout');
  revalidatePath('/admin/trips', 'layout');
  revalidatePath('/admin/locations', 'layout');
  return { message: 'Photo saved. Publication and relationships validated.', values };
}

export async function deletePhoto(id: string, _previous: FormState, form: FormData): Promise<FormState> {
  const { client } = await requireAdmin();
  if (!uuidSchema.safeParse(id).success) return { error: 'Invalid Photo identifier.' };
  if (form.get('confirm') !== 'yes') return { error: 'Confirm deletion before continuing.' };
  try { await createIngestion(createImportRepository(client), createR2Storage()).delete(id); } catch (error) {
    revalidatePath('/admin/photos', 'layout');
    return { error: error instanceof PhotoWorkflowError ? error.message : 'Deletion could not start. Check R2 setup; no success has been confirmed.' };
  }
  revalidatePath('/admin/photos', 'layout'); revalidatePath('/admin/trips', 'layout'); revalidatePath('/admin/locations', 'layout');
  redirect('/admin/photos?deleted=1');
}
