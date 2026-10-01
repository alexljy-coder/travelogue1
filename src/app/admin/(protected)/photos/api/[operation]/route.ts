import { createSessionClient } from '@/lib/supabase/server';
import { photoApiAccess } from '@/lib/photos/api-boundary';
import { batchSchema, cleanupSchema, finishSchema, prepareSchema, processSchema } from '@/lib/photos/model';
import { createIngestion, PhotoWorkflowError } from '@/lib/photos/ingestion';
import { createImportRepository, photoDatabaseError } from '@/lib/photos/repository';
import { createR2Storage } from '@/lib/r2/storage';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
export const maxDuration = 120;
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function POST(request: Request, { params }: { params: Promise<{ operation: string }> }) {
  let client;
  try { client = await createSessionClient(); } catch { return response({ error: 'Supabase is not configured.' }, 503); }
  const denied = await photoApiAccess(request, client);
  if (denied) return denied;
  const { operation } = await params;
  if (!['batch','prepare','process','cleanup','finish','cancel'].includes(operation)) return response({ error: 'Unknown import operation.' }, 404);
  // Only small metadata JSON crosses Vercel, never source-image request bodies.
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 16384) return response({ error: 'Import metadata is too large.' }, 413);
  let input: unknown;
  try { const body = await request.text(); if (body.length > 16384) return response({ error: 'Import metadata is too large.' }, 413); input = JSON.parse(body); } catch { return response({ error: 'Invalid import request.' }, 400); }
  const schema = operation === 'batch' ? batchSchema : operation === 'prepare' ? prepareSchema : ['process','cancel'].includes(operation) ? processSchema : operation === 'finish' ? finishSchema : cleanupSchema;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return response({ error: parsed.error.issues[0]?.message ?? 'Invalid import request.' }, 400);
  try {
    if (operation === 'batch') {
      const data = batchSchema.parse(input);
      const { error } = await client.rpc('admin_create_import_batch', { p_id: data.id, p_source_name: data.source_name, p_total: data.total, p_eligible: data.eligible, p_skipped: data.skipped });
      if (error) throw new PhotoWorkflowError(photoDatabaseError(error));
      return response({ id: data.id });
    }
    if (operation === 'finish') {
      const { id, failed } = finishSchema.parse(input);
      const { error } = await client.rpc('admin_finish_import_batch', { p_id: id, p_failed: failed });
      if (error) throw new PhotoWorkflowError(photoDatabaseError(error));
      revalidatePath('/admin/photos', 'layout');
      return response({ ok: true });
    }
    const ingestion = createIngestion(createImportRepository(client), createR2Storage());
    if (operation === 'prepare') return response(await ingestion.prepare(prepareSchema.parse(input)));
    if (operation === 'cancel') {
      const { id, token } = processSchema.parse(input); await ingestion.cancel(id, token);
      revalidatePath('/admin/photos', 'layout'); return response({ ok: true });
    }
    if (operation === 'process') {
      const { id, token } = processSchema.parse(input);
      const result = await ingestion.process(id, token);
      revalidatePath('/admin/photos', 'layout');
      return response(result);
    }
    await ingestion.cleanup(cleanupSchema.parse(input).id);
    revalidatePath('/admin/photos', 'layout');
    return response({ ok: true });
  } catch (error) {
    return response({ error: error instanceof PhotoWorkflowError ? error.message : 'R2 operation failed. Check setup/connectivity, then refresh import status.' }, error instanceof PhotoWorkflowError ? error.status : 503);
  }
}
