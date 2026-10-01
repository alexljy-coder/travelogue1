import { randomUUID } from 'node:crypto';
import { processJpeg } from './image';
import type { PrepareInput } from './model';
import type { Database } from '@/types/database';

export type ImportItem = Database['public']['Tables']['import_items']['Row'];
export type Photo = Database['public']['Tables']['photos']['Row'];
export type ImageResult = Awaited<ReturnType<typeof processJpeg>>;
export class PhotoWorkflowError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}
export interface ImportRepository {
  reserve(input: PrepareInput): Promise<string>;
  item(id: string): Promise<ImportItem>;
  photo(id: string): Promise<Photo | null>;
  claim(id: string, token: string, phase: 'prepare' | 'process' | 'cleanup' | 'cancel'): Promise<void>;
  markUpload(id: string, token: string, uploadId: string): Promise<void>;
  finalize(id: string, token: string, metadata: ImageResult['metadata']): Promise<void>;
  fail(id: string, token: string, clean: boolean): Promise<void>;
  beginDelete(id: string, token: string): Promise<void>;
  finishDelete(id: string, token: string): Promise<void>;
  failDelete(id: string, token: string): Promise<void>;
}
export interface PhotoStorage {
  createUpload(id: string, size: number): Promise<{ uploadId: string; url: string }>;
  completeUpload(id: string, uploadId: string, size: number): Promise<void>;
  readSource(id: string): Promise<Buffer>;
  putDerivative(id: string, variant: ImageResult['derivatives'][number]['variant'], bytes: Buffer): Promise<void>;
  removeAll(id: string): Promise<void>;
}
const owns = (item: ImportItem, token: string) => item.claim_token === token && item.lease_until !== null && new Date(item.lease_until).getTime() > Date.now();
export function createIngestion(repo: ImportRepository, storage: PhotoStorage, processImage = processJpeg) {
  async function assertClaim(id: string, token: string) {
    const item = await repo.item(id);
    if (!owns(item, token)) throw new PhotoWorkflowError('Operation expired or changed. Refresh its status before retrying.');
    return item;
  }
  async function cleanupFailure(id: string, token: string) {
    const photo = await repo.photo(id);
    if (photo) return false; // Never remove objects after a possibly committed finalize.
    await assertClaim(id, token);
    let clean = true;
    try { await storage.removeAll(id); } catch { clean = false; }
    await repo.fail(id, token, clean);
    return clean;
  }
  return {
    async prepare(input: PrepareInput) {
      const id = await repo.reserve(input);
      const photo = await repo.photo(id);
      if (photo) {
        if (photo.processing_status !== 'ready') throw new PhotoWorkflowError('This file has an unfinished deletion. Finish deleting it before importing again.');
        return { id, existing: true as const };
      }
      const item = await repo.item(id); const token = randomUUID();
      await repo.claim(id, token, 'prepare');
      try {
        // Aborts stale multipart sessions as well as deleting remnants from failed attempts.
        await storage.removeAll(id);
        await assertClaim(id, token);
        const { uploadId, url } = await storage.createUpload(id, item.file_size);
        await repo.markUpload(id, token, uploadId);
        return { id, token, url, existing: false as const };
      } catch {
        try { await cleanupFailure(id, token); } catch { /* Durable row retains recovery identity after uncertain DB/network state. */ }
        throw new PhotoWorkflowError('Unable to prepare upload. Check R2 setup and import status before retrying.', 503);
      }
    },
    async process(id: string, token: string) {
      const existing = await repo.photo(id);
      if (existing?.processing_status === 'ready') return { id, existing: true };
      await repo.claim(id, token, 'process');
      let stage = 'source completion';
      try {
        const item = await assertClaim(id, token);
        if (!item.multipart_id) throw new PhotoWorkflowError('Upload session is missing.');
        await storage.completeUpload(id, item.multipart_id, item.file_size);
        stage = 'source retrieval';
        const bytes = await storage.readSource(id);
        stage = 'JPEG verification and derivative generation';
        const result = await processImage(bytes, item.file_hash, item.file_size);
        stage = 'derivative storage';
        for (const derivative of result.derivatives) {
          await assertClaim(id, token);
          await storage.putDerivative(id, derivative.variant, derivative.bytes);
        }
        stage = 'database save';
        await repo.finalize(id, token, result.metadata);
        return { id, existing: false };
      } catch {
        try {
          const photo = await repo.photo(id);
          if (photo?.processing_status === 'ready') return { id, existing: true }; // Lost response after commit.
          const clean = await cleanupFailure(id, token);
          throw new PhotoWorkflowError(clean ? `Import failed during ${stage}. Storage was cleaned; retry after checking R2/database setup or the Lightroom JPEG export (sRGB, 4000px or smaller).` : 'Import failed and storage cleanup is incomplete. Use Retry cleanup in import status.', 503);
        } catch (error) {
          if (error instanceof PhotoWorkflowError) throw error;
          throw new PhotoWorkflowError('Import outcome could not be confirmed. Refresh import status; do not assume success. Active operations expire before cleanup can be retried.', 503);
        }
      }
    },
    async cleanup(id: string) {
      if (await repo.photo(id)) throw new PhotoWorkflowError('This item has a Photo record. Use Photo deletion instead.');
      const token = randomUUID();
      await repo.claim(id, token, 'cleanup');
      const clean = await cleanupFailure(id, token);
      if (!clean) throw new PhotoWorkflowError('Storage cleanup is incomplete. Check R2 permissions/connectivity and retry.', 503);
    },
    async cancel(id: string, token: string) {
      if (await repo.photo(id)) throw new PhotoWorkflowError('This item already has a Photo. Refresh its status.');
      await repo.claim(id, token, 'cancel');
      if (!await cleanupFailure(id, token)) throw new PhotoWorkflowError('Upload cancellation needs storage cleanup. Retry cleanup in import status.', 503);
    },
    async delete(id: string) {
      const photo = await repo.photo(id);
      if (!photo) {
        // A missing RLS-visible row alone is not proof of deletion (authorization
        // can change during a request). Require the durable deleted tombstone.
        if ((await repo.item(id)).state === 'deleted') return;
        throw new PhotoWorkflowError('Photo deletion is not confirmed. Refresh import status.');
      }
      if (photo.storage_key !== `${id}/`) throw new PhotoWorkflowError('This Photo uses an unsupported legacy storage prefix. No objects were deleted.');
      const token = randomUUID();
      await repo.beginDelete(id, token); // Withdraw public visibility and block new claims before storage deletion.
      try {
        await assertClaim(id, token);
        await storage.removeAll(id);
        await repo.finishDelete(id, token);
      } catch {
        try {
          if (!await repo.photo(id) && (await repo.item(id)).state === 'deleted') return;
          await repo.failDelete(id, token);
        } catch { /* Retained hidden row/operation can be recovered after lease expiry. */ }
        throw new PhotoWorkflowError('Deletion is incomplete. The Photo is hidden. Check R2 connectivity and retry deletion.', 503);
      }
    },
  };
}
