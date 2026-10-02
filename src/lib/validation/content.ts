import { z } from 'zod';

export const uuidSchema = z.uuid();
export function slugify(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
const name = z.string().trim().min(1, 'Enter a name.').max(200, 'Use 200 characters or fewer.');
const slug = z.string().trim().min(1, 'Enter a URL name.').max(200).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens.');
const optionalText = z.string().trim().max(20000).transform((value) => value || null);
export const optionalDate = z.string().trim().refine((value) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Enter a valid calendar date.').transform((value) => value || null);
const optionalNumber = z.string().trim().transform((value) => value ? Number(value) : null).pipe(z.number().finite().nullable());
export const optionalPosition = optionalNumber.pipe(z.number().int().min(0, 'Position cannot be negative.').max(2147483647).nullable());
const coordinates = {
  latitude: optionalNumber.pipe(z.number().min(-90).max(90).nullable()),
  longitude: optionalNumber.pipe(z.number().min(-180).max(180).nullable()),
};
function pairedCoordinates(data: { latitude: number | null; longitude: number | null }, ctx: z.RefinementCtx) {
  if ((data.latitude === null) !== (data.longitude === null)) ctx.addIssue({ code: 'custom', path: [data.latitude === null ? 'latitude' : 'longitude'], message: 'Enter both coordinates, or leave both empty.' });
}
export const tripSchema = z.object({
  title: name, slug, start_date: optionalDate, end_date: optionalDate,
  purpose: z.enum(['', 'leisure', 'business', 'family', 'photography', 'mixed']).transform((value) => value || null),
  description: optionalText, status: z.enum(['draft', 'published']), editorial_order: optionalPosition,
}).superRefine((data, ctx) => {
  if (data.start_date && data.end_date && data.end_date < data.start_date) ctx.addIssue({ code: 'custom', path: ['end_date'], message: 'End date cannot precede start date.' });
});
export const locationSchema = z.object({
  name, slug, city_id: uuidSchema, ...coordinates,
  description: optionalText, status: z.enum(['draft', 'published']), editorial_order: optionalPosition,
}).superRefine(pairedCoordinates);
export const citySchema = z.object({
  name, slug, country_id: z.union([uuidSchema, z.literal('new')]), ...coordinates,
  country_name: z.string().trim().max(200), country_code: z.string().trim().toUpperCase(), country_slug: z.string().trim(),
}).superRefine((data, ctx) => {
  pairedCoordinates(data, ctx);
  if (data.country_id === 'new') {
    if (!data.country_name) ctx.addIssue({ code: 'custom', path: ['country_name'], message: 'Enter a Country name.' });
    if (!/^[A-Z]{2}$/.test(data.country_code)) ctx.addIssue({ code: 'custom', path: ['country_code'], message: 'Use the two-letter Country code, such as CN or GB.' });
    if (!slug.safeParse(data.country_slug).success) ctx.addIssue({ code: 'custom', path: ['country_slug'], message: 'Enter a lowercase URL name with letters, numbers and hyphens.' });
  }
});
export const tripCitySchema = z.object({ city_id: uuidSchema, sequence: optionalPosition });
export const tripLocationSchema = z.object({ location_id: uuidSchema, sequence: optionalPosition, visited_at: optionalDate });

const optionalRating = optionalNumber.pipe(z.number().int('Use whole stars only.').min(1).max(5).nullable());
const flag = z.enum(['', 'yes']).transform(value => value === 'yes');
export const hotelSchema = z.object({
  name, slug, city_id: uuidSchema, ...coordinates, brand: optionalText, address: optionalText,
  description: optionalText, rating: optionalRating,
  recommended_family: flag, recommended_business: flag, recommended_leisure: flag,
  status: z.enum(['draft','published']), editorial_order: optionalPosition,
}).superRefine(pairedCoordinates);
export const staySchema = z.object({
  hotel_id: uuidSchema, trip_id: z.union([uuidSchema,z.literal('')]).transform(value=>value||null), check_in: optionalDate, check_out: optionalDate,
  room_type: optionalText, purpose: z.enum(['','business','leisure','family','mixed']).transform(value => value || null),
  rating: optionalRating, review_text: optionalText, internal_notes: optionalText,
  status: z.enum(['draft','published']), editorial_order: optionalPosition,
}).superRefine((data,ctx) => {
  if(data.check_in && data.check_out && data.check_out < data.check_in) ctx.addIssue({code:'custom',path:['check_out'],message:'Check-out cannot precede check-in.'});
});
