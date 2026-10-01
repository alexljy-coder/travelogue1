'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { hotelSchema, staySchema, slugify, uuidSchema } from '@/lib/validation/content';
import { valuesFor, validationState, databaseError, type FormState } from '@/lib/admin/form-state';
function refresh() { for (const path of ['/admin/hotels', '/admin/stays', '/admin/trips', '/admin/photos'])
    revalidatePath(path, 'layout'); }
export async function saveHotel(id: string | null, _previous: FormState, form: FormData): Promise<FormState> {
    const { client } = await requireAdmin();
    const values = valuesFor(form, ['name', 'slug', 'city_id', 'brand', 'address', 'latitude', 'longitude', 'description', 'rating', 'recommended_family', 'recommended_business', 'recommended_leisure', 'status', 'editorial_order']);
    if (id && !uuidSchema.safeParse(id).success)
        return { error: 'Invalid Hotel identifier.', values };
    values.slug ||= slugify(values.name);
    const result = hotelSchema.safeParse(values);
    if (!result.success)
        return validationState(values, result.error.issues);
    const { data, error } = await client.rpc('admin_save_hotel', { p_id: id, p_record: result.data });
    if (error)
        return { error: databaseError(error), values };
    refresh();
    if (!id)
        redirect(`/admin/hotels/${data}?saved=1`);
    return { message: 'Hotel saved. Its City is included in associated Trips.', values };
}
export async function saveStay(id: string | null, _previous: FormState, form: FormData): Promise<FormState> {
    const { client } = await requireAdmin();
    const values = valuesFor(form, ['hotel_id', 'trip_id', 'check_in', 'check_out', 'room_type', 'purpose', 'rating', 'review_text', 'internal_notes', 'status', 'editorial_order']);
    if (id && !uuidSchema.safeParse(id).success)
        return { error: 'Invalid Stay identifier.', values };
    const result = staySchema.safeParse(values);
    if (!result.success)
        return validationState(values, result.error.issues);
    const { data, error } = await client.rpc('admin_save_stay', { p_id: id, p_record: result.data });
    if (error)
        return { error: databaseError(error), values };
    refresh();
    if (!id)
        redirect(`/admin/stays/${data}?saved=1`);
    return { message: 'Stay saved. Private notes remain administrator-only.', values };
}
export async function deleteHotel(id: string, _previous: FormState, form: FormData): Promise<FormState> {
    const { client } = await requireAdmin();
    if (!uuidSchema.safeParse(id).success)
        return { error: 'Invalid Hotel identifier.' };
    if (form.get('confirm') !== 'yes')
        return { error: 'Confirm deletion before continuing.' };
    const { error } = await client.from('hotels').delete().eq('id', id).select('id').single();
    if (error)
        return { error: databaseError(error) };
    refresh();
    redirect('/admin/hotels?deleted=1');
}
export async function deleteStay(id: string, _previous: FormState, form: FormData): Promise<FormState> {
    const { client } = await requireAdmin();
    if (!uuidSchema.safeParse(id).success)
        return { error: 'Invalid Stay identifier.' };
    if (form.get('confirm') !== 'yes')
        return { error: 'Confirm deletion before continuing.' };
    const { error } = await client.from('stays').delete().eq('id', id).select('id').single();
    if (error)
        return { error: databaseError(error) };
    refresh();
    redirect('/admin/stays?deleted=1');
}
