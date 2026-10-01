import { z } from 'zod';
import { optionalPosition } from './content';

const assignment = z.union([z.uuid(), z.literal('')]).transform((value) => value || null);
export const photoEditSchema = z.object({
  classification: z.enum(['nice','record']), status: z.enum(['draft','published']),
  featured: z.enum(['','yes']).transform((value) => value === 'yes'),
  trip_id: assignment, location_id: assignment,
  caption: z.string().trim().max(2000).transform((value) => value || null),
  description: z.string().trim().max(20000).transform((value) => value || null),
  editorial_order: optionalPosition,
}).superRefine((data, ctx) => {
  if (data.status === 'published' && !data.trip_id) ctx.addIssue({ code: 'custom', path: ['trip_id'], message: 'Choose a Trip before publishing.' });
  if (data.status === 'published' && !data.location_id) ctx.addIssue({ code: 'custom', path: ['location_id'], message: 'Choose a Location before publishing.' });
  if (data.featured && (data.status !== 'published' || data.classification !== 'nice')) ctx.addIssue({ code: 'custom', path: ['featured'], message: 'Featured requires Published and Nice.' });
});
