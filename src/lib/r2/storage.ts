import 'server-only';
import { S3Client, AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, ListMultipartUploadsCommand, ListPartsCommand, PutObjectCommand, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getR2Config } from './config';
import { MAX_SOURCE_BYTES, objectKey, variants, type Variant } from '@/lib/photos/model';

export const missingObject = (error: unknown) => !!error && typeof error === 'object' && ('$metadata' in error && (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 404 || 'name' in error && ['NoSuchKey','NotFound','NoSuchUpload'].includes(String(error.name)));
export function createR2Storage() {
  const config = getR2Config();
  const client = new S3Client({
    endpoint: `https://${config.accountId}${config.jurisdiction === 'default' ? '' : `.${config.jurisdiction}`}.r2.cloudflarestorage.com`, region: 'auto',
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
    requestHandler: { connectionTimeout: 5000, requestTimeout: 30000 }, maxAttempts: 2,
  });
  const Bucket = config.bucket;
  return {
    async connectivity() { await client.send(new HeadBucketCommand({ Bucket })); },
    async createUpload(id: string, size: number) {
      const Key = objectKey(id, 'source');
      const result = await client.send(new CreateMultipartUploadCommand({ Bucket, Key, ContentType: 'image/jpeg', CacheControl: 'private, no-store' }));
      if (!result.UploadId) throw new Error('Unable to begin source upload.');
      const uploadId = result.UploadId;
      // One single-part multipart upload: only the authenticated server can complete it.
      const url = await getSignedUrl(client, new UploadPartCommand({ Bucket, Key, UploadId: uploadId, PartNumber: 1, ContentLength: size }), { expiresIn: 120, signableHeaders: new Set(['content-length']) });
      return { uploadId, url };
    },
    async completeUpload(id: string, uploadId: string, expectedSize: number) {
      const Key = objectKey(id, 'source');
      const parts = await client.send(new ListPartsCommand({ Bucket, Key, UploadId: uploadId }));
      if (parts.IsTruncated || parts.Parts?.length !== 1 || parts.Parts[0].PartNumber !== 1 || parts.Parts[0].Size !== expectedSize || !parts.Parts[0].ETag) throw new Error('Uploaded source has unexpected size or parts.');
      await client.send(new CompleteMultipartUploadCommand({ Bucket, Key, UploadId: uploadId, MultipartUpload: { Parts: [{ PartNumber: 1, ETag: parts.Parts[0].ETag }] } }));
    },
    async readSource(id: string) {
      const result = await client.send(new GetObjectCommand({ Bucket, Key: objectKey(id, 'source') }));
      if (!result.Body || !result.ContentLength || result.ContentLength > MAX_SOURCE_BYTES) { result.Body?.transformToWebStream().cancel(); throw new Error('Invalid source size.'); }
      const chunks: Uint8Array[] = []; let size = 0;
      for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
        size += chunk.byteLength;
        if (size > MAX_SOURCE_BYTES) throw new Error('Source exceeds the import size limit.');
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    },
    async putDerivative(id: string, variant: Exclude<Variant, 'source'>, bytes: Buffer) {
      await client.send(new PutObjectCommand({ Bucket, Key: objectKey(id, variant), Body: bytes, ContentType: 'image/webp', CacheControl: 'private, no-store' }));
    },
    async removeAll(id: string) {
      const sourceKey = objectKey(id, 'source');
      let keyMarker: string | undefined; let uploadMarker: string | undefined;
      do {
        const result = await client.send(new ListMultipartUploadsCommand({ Bucket, Prefix: sourceKey, KeyMarker: keyMarker, UploadIdMarker: uploadMarker }));
        for (const upload of result.Uploads ?? []) if (upload.Key === sourceKey && upload.UploadId) {
          try { await client.send(new AbortMultipartUploadCommand({ Bucket, Key: sourceKey, UploadId: upload.UploadId })); } catch (error) { if (!missingObject(error)) throw error; }
        }
        keyMarker = result.IsTruncated ? result.NextKeyMarker : undefined;
        uploadMarker = result.IsTruncated ? result.NextUploadIdMarker : undefined;
        if (result.IsTruncated && !keyMarker) throw new Error('Unable to inspect incomplete uploads.');
      } while (keyMarker);
      const results = await Promise.allSettled(variants.map(async (variant) => {
        const Key = objectKey(id, variant);
        await client.send(new DeleteObjectCommand({ Bucket, Key }));
        try { await client.send(new HeadObjectCommand({ Bucket, Key })); } catch (error) { if (missingObject(error)) return; throw error; }
        throw new Error('Object still exists after deletion.');
      }));
      if (results.some((result) => result.status === 'rejected')) throw new Error('Some photo objects could not be removed.');
    },
    async media(id: string, variant: Variant) {
      const result = await client.send(new GetObjectCommand({ Bucket, Key: objectKey(id, variant) }));
      if (!result.Body) throw new Error('Photo representation is missing.');
      return { body: result.Body.transformToWebStream(), contentType: variant === 'source' ? 'image/jpeg' : 'image/webp' };
    },
  };
}
