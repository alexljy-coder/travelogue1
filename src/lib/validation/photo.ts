import { z } from 'zod';
import { optionalPosition } from './content';

const assignment = z.union([z.uuid(), z.literal('')]).transform((value) => value || null);
export const photoEditSchema = z.object({
  classification: z.enum(['nice','record']), status: z.enum(['draft','published']),
  featured: z.enum(['','yes']).transform((value) => value === 'yes'),
  context: z.enum(['travel','hotel']).default('travel'), hotel_id: assignment.default(''),
  trip_id: assignment, location_id: assignment,
  caption: z.string().trim().max(2000).transform((value) => value || null),
  description: z.string().trim().max(20000).transform((value) => value || null),
  editorial_order: optionalPosition,
}).superRefine((data, ctx) => {
  if (data.context === 'travel' && data.status === 'published' && !data.location_id) ctx.addIssue({ code: 'custom', path: ['location_id'], message: 'Choose a Location before publishing.' });
  if(data.context === 'hotel' && data.status === 'published' && !data.hotel_id) ctx.addIssue({code:'custom',path:['hotel_id'],message:'Choose a Hotel before publishing.'});
  if(data.context === 'hotel' && (data.trip_id || data.location_id) || data.context === 'travel' && data.hotel_id) ctx.addIssue({code:'custom',path:['context'],message:'Use only the relationships for the selected context.'});
  if (data.featured && (data.status !== 'published' || data.classification !== 'nice')) ctx.addIssue({ code: 'custom', path: ['featured'], message: 'Featured requires Published and Nice.' });
});
