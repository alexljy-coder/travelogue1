import { z } from 'zod';

export const MAX_BATCH = 10;
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
export const variants = ['source', 'large', 'medium', 'thumbnail', 'tiny'] as const;
export type Variant = typeof variants[number];
export const legacyDerivativeEdges = { large: 2400, medium: 1600, thumbnail: 600, tiny: 300 } as const;
export const derivativeEdges = { large: 3200, medium: 1920, thumbnail: 960, tiny: 480 } as const;
export const MAX_SOURCE_PIXELS = 80_000_000;
export const webpQuality = { large: 85, medium: 82, thumbnail: 80, tiny: 75 } as const;
export function objectKey(id: string, variant: Variant) {
  if (!z.uuid().safeParse(id).success || !variants.includes(variant)) throw new Error('Invalid photo identity or representation.');
  return `${id}/${variant === 'source' ? 'source.jpg' : `${variant}.webp`}`;
}
export function derivativeSize(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export type Classification = 'nice' | 'record';
export function classifyPath(path: string, fallback?: Classification): Classification | 'personal' | 'unclassified' {
  const folders = path.replaceAll('\\', '/').split('/').slice(0, -1).map((part) => part.trim().toLowerCase());
  // Personal always wins, even inside another classified folder.
  if (folders.includes('03 personal')) return 'personal';
  const nice = folders.includes('01 nice'); const record = folders.includes('02 record shots');
  if (nice && record) return 'unclassified';
  if (nice) return 'nice';
  if (record) return 'record';
  return fallback ?? 'unclassified';
}
const id = z.uuid();
export const batchSchema = z.object({ id, source_name: z.string().trim().max(200), total: z.number().int().min(1).max(10000), eligible: z.number().int().min(1).max(MAX_BATCH), skipped: z.number().int().min(0) }).refine((data) => data.total >= data.eligible + data.skipped);
export const prepareSchema = z.object({
  id, batch_id: id, filename: z.string().trim().min(1).max(255).refine((name) => !/[\\/\u0000-\u001f]/.test(name)),
  context: z.enum(['travel','hotel']).default('travel'), stay_id: z.uuid().nullable().default(null),
  path: z.string().max(2000), classification: z.enum(['nice', 'record']),
  file_hash: z.string().regex(/^[a-f0-9]{64}$/), file_size: z.number().int().min(1).max(MAX_SOURCE_BYTES),
}).superRefine((data, ctx) => {
  if(data.context==='travel' && data.stay_id) ctx.addIssue({code:'custom',path:['stay_id'],message:'Travel photos cannot reference a Stay.'});
  const result = classifyPath(data.path, data.classification);
  if (result !== data.classification) ctx.addIssue({ code: 'custom', path: ['classification'], message: 'Personal or ambiguous folder paths cannot be uploaded.' });
  if (!/\.jpe?g$/i.test(data.filename)) ctx.addIssue({ code: 'custom', path: ['filename'], message: 'Select Lightroom-exported JPEGs only.' });
});
export type PrepareInput = z.input<typeof prepareSchema>;
export const processSchema = z.object({ id, token: id });
export const cleanupSchema = z.object({ id });
export const finishSchema = z.object({ id, failed: z.boolean().default(false) });

export type ScannableFile = { name: string; size: number; webkitRelativePath?: string };
export function scanFiles<T extends ScannableFile>(files: T[], fallback?: Classification) {
  const eligible: { file: T; path: string; classification: Classification }[] = [];
  const skipped: string[] = []; const errors: string[] = [];
  for (const file of files) {
    const path = file.webkitRelativePath || file.name;
    const classification = classifyPath(path, fallback);
    if (classification === 'personal') { skipped.push(path); continue; }
    if (classification === 'unclassified') { errors.push(`${path}: choose Nice or Record, or select a classified export folder.`); continue; }
    if (!/\.jpe?g$/i.test(file.name) || file.size < 1 || file.size > MAX_SOURCE_BYTES) { errors.push(`${path}: use a JPEG of 25 MiB or less.`); continue; }
    eligible.push({ file, path, classification });
  }
  if (eligible.length > MAX_BATCH) errors.push(`Select at most ${MAX_BATCH} eligible JPEGs for this proof.`);
  return { eligible, skipped, errors };
}
