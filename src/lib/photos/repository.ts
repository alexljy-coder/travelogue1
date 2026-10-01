import 'server-only';
import type { AdminClient } from '@/lib/admin/queries';
import { databaseError } from '@/lib/admin/form-state';
import { PhotoWorkflowError, type ImportRepository } from './ingestion';

const messages = new Set(['These bytes already have another context or Stay. Edit the existing Photo; importing never replaces it.','Select an existing Stay.','Invalid import counts.','Import request identity mismatch.','Import batch not found.','This request was deleted. Select the file again to create a new request.','This batch has reached its file limit.','Import item not found.','Upload expired or is already being processed. Retry after its lease expires.','This import cannot be retried.','This photo has an active operation. Wait before retrying.','Import operation expired.','Import operation changed. Refresh to check its state.','Photo not found.','Remove this photo from covers before deleting it.','Delete operation expired. Retry deletion.']);
export function photoDatabaseError(error: { code?: string; message?: string }) {
  return error.code === 'P0001' && error.message && messages.has(error.message) ? error.message : databaseError(error);
}
export function createImportRepository(client: AdminClient): ImportRepository {
  async function rpc<T>(result: PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>) {
    const { data, error } = await result;
    if (error) throw new PhotoWorkflowError(photoDatabaseError(error));
    return data;
  }
  return {
    async reserve(input) {
      const id = await rpc(client.rpc('admin_reserve_context_photo_import', { p_id: input.id, p_batch_id: input.batch_id, p_filename: input.filename, p_hash: input.file_hash, p_size: input.file_size, p_classification: input.classification, p_context: input.context ?? 'travel', p_stay_id: input.stay_id ?? null }));
      if (!id) throw new PhotoWorkflowError('Unable to reserve import.');
      return id;
    },
    async item(id) {
      const { data, error } = await client.from('import_items').select('*').eq('id', id).single();
      if (error || !data) throw new PhotoWorkflowError('Unable to confirm import status. Refresh and try again.', 503);
      return data;
    },
    async photo(id) {
      const { data, error } = await client.from('photos').select('*').eq('id', id).maybeSingle();
      if (error) throw new PhotoWorkflowError('Unable to confirm Photo state. Refresh and try again.', 503);
      return data;
    },
    async claim(id, token, phase) { await rpc(client.rpc('admin_claim_photo_import', { p_id: id, p_token: token, p_phase: phase })); },
    async markUpload(id, token, uploadId) { await rpc(client.rpc('admin_mark_photo_upload', { p_id: id, p_token: token, p_multipart_id: uploadId })); },
    async finalize(id, token, metadata) { await rpc(client.rpc('admin_finalize_photo_import', { p_id: id, p_token: token, p_metadata: metadata })); },
    async fail(id, token, clean) { await rpc(client.rpc('admin_fail_photo_import', { p_id: id, p_token: token, p_cleanup_ok: clean })); },
    async beginDelete(id, token) { await rpc(client.rpc('admin_begin_photo_delete', { p_id: id, p_token: token })); },
    async finishDelete(id, token) { await rpc(client.rpc('admin_finish_photo_delete', { p_id: id, p_token: token })); },
    async failDelete(id, token) { await rpc(client.rpc('admin_fail_photo_delete', { p_id: id, p_token: token })); },
  };
}
