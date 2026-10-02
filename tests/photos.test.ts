import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { classifyPath, derivativeSize, objectKey, prepareSchema, scanFiles, variants } from '../src/lib/photos/model';
import { normalizeExif, processJpeg } from '../src/lib/photos/image';
import { photoEditSchema } from '../src/lib/validation/photo';
import { photoApiAccess } from '../src/lib/photos/api-boundary';
import { getR2Config } from '../src/lib/r2/config';

test('folder classification is explicit; Personal wins and ambiguous paths are blocked', () => {
  assert.equal(classifyPath('Export/01 Nice/a.jpg'), 'nice');
  assert.equal(classifyPath('Export/02 Record Shots/a.jpg'), 'record');
  assert.equal(classifyPath('01 Nice/03 Personal/a.jpg', 'nice'), 'personal');
  assert.equal(classifyPath('01 Nice/02 Record Shots/a.jpg', 'nice'), 'unclassified');
  assert.equal(classifyPath('a.jpg'), 'unclassified');
  assert.equal(classifyPath('a.jpg', 'record'), 'record');
});
test('Personal files are excluded using metadata only, before any byte reader or upload exists', () => {
  let reads = 0;
  const personal = { name: 'secret.jpg', size: 100, webkitRelativePath: 'Export/03 Personal/secret.jpg', arrayBuffer() { reads++; throw new Error('Must not read Personal.'); } };
  const scan = scanFiles([personal, { ...personal, name: 'nice.jpg', webkitRelativePath: 'Export/01 Nice/nice.jpg' }]);
  assert.equal(reads, 0); assert.equal(scan.skipped.length, 1); assert.equal(scan.eligible.length, 1);
  const input = { id: randomUUID(), batch_id: randomUUID(), filename: 'secret.jpg', path: personal.webkitRelativePath, classification: 'nice', file_size: 100, file_hash: 'a'.repeat(64) };
  assert.equal(prepareSchema.safeParse(input).success, false);
  assert.ok(scanFiles(Array.from({ length: 11 }, (_, i) => ({ name: `${i}.jpg`, size: 100 })), 'nice').errors.length);
});
test('R2 keys use only UUID identity and five known representations', () => {
  const id = randomUUID();
  assert.deepEqual(variants.map((variant) => objectKey(id, variant)), ['source.jpg','large.webp','medium.webp','thumbnail.webp','tiny.webp'].map((name) => `${id}/${name}`));
  assert.throws(() => objectKey('../file', 'source'));
  assert.deepEqual(derivativeSize(4000, 2000, 2400), { width: 2400, height: 1200 });
  assert.deepEqual(derivativeSize(1000, 4000, 600), { width: 150, height: 600 });
  assert.deepEqual(derivativeSize(200, 100, 300), { width: 200, height: 100 });
});
test('optional EXIF is not fabricated, wall time keeps only a known timezone offset', () => {
  assert.equal(normalizeExif().captured_at, null);
  const data = normalizeExif({ DateTimeOriginal: '1999:12:31 23:01:02', OffsetTimeOriginal: '+08:00', Make: 'Camera', Model: 'Model', LensModel: 'Lens', FNumber: 2.8, FocalLength: 35, ExposureTime: 1/125, ISO: 400, latitude: 0, longitude: 103.8 });
  assert.equal(data.captured_at, '1999-12-31T23:01:02'); assert.equal(data.captured_at_offset_minutes, 480);
  assert.equal(data.shutter_speed, '1/125'); assert.equal(data.latitude, 0);
  assert.equal(normalizeExif({ DateTimeOriginal: '2023:02:29 01:00:00', latitude: 1 }).captured_at, null);
  assert.equal(normalizeExif({ DateTimeOriginal: '1999:12:31 23:01:02' }).captured_at_offset_minutes, null);
  assert.equal(normalizeExif({ ExposureTime: 0.6 }).shutter_speed, '0.6s');
});
test('real JPEG processing handles no EXIF, aspect ratio, sizing and invalid source checksum', async () => {
  const source = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: '#ab9876' } }).jpeg().toBuffer();
  const hash = createHash('sha256').update(source).digest('hex');
  const result = await processJpeg(source, hash, source.length);
  assert.equal(result.metadata.captured_at, null); assert.equal(result.metadata.latitude, null);
  const dimensions = [];
  for (const derivative of result.derivatives) {
    const metadata = await sharp(derivative.bytes).metadata();
    dimensions.push([metadata.width, metadata.height]); assert.equal(metadata.format, 'webp'); assert.equal(metadata.exif, undefined);
  }
  assert.deepEqual(dimensions, [[3000,1500],[1920,960],[960,480],[480,240]]);
  await assert.rejects(processJpeg(source, '0'.repeat(64), source.length));
  const png = await sharp(source).png().toBuffer();
  await assert.rejects(processJpeg(png, createHash('sha256').update(png).digest('hex'), png.length));
});
test('real EXIF, GPS and orientation are preserved in database metadata and stripped from derivatives', async () => {
  const source = await sharp({ create: { width: 1200, height: 600, channels: 3, background: '#999999' } }).jpeg().withExif({
    IFD0: { Make: 'Test Make', Model: 'Test Model', Orientation: '6' },
    IFD2: { DateTimeOriginal: '2001:02:03 04:05:06', LensModel: 'Test Lens', FNumber: '28/10', FocalLength: '35/1', ISOSpeedRatings: '200', ExposureTime: '1/125', OffsetTimeOriginal: '+08:00' },
    IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '1/1 12/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '103/1 48/1 0/1' },
  }).withMetadata({ orientation: 6 }).toBuffer();
  const result = await processJpeg(source, createHash('sha256').update(source).digest('hex'), source.length);
  assert.equal(result.metadata.camera_make, 'Test Make'); assert.equal(result.metadata.captured_at, '2001-02-03T04:05:06');
  assert.equal(result.metadata.captured_at_offset_minutes, 480);
  assert.ok(Math.abs((result.metadata.latitude ?? 0)-1.2)<0.0001); assert.ok(Math.abs((result.metadata.longitude ?? 0)-103.8)<0.0001);
  assert.deepEqual([result.metadata.width,result.metadata.height], [600,1200]);
  for (const derivative of result.derivatives) {
    const metadata = await sharp(derivative.bytes).metadata(); assert.equal(metadata.exif, undefined); assert.equal(metadata.xmp, undefined);
    assert.equal(derivative.bytes.includes(Buffer.from('EXIF')), false);
    assert.ok(metadata.height!<=1200); assert.ok(metadata.width!<=600);
  }
});
test('photo editing requires assignments and valid Featured eligibility', () => {
  const data = { classification: 'nice', status: 'draft', featured: '', trip_id: '', location_id: '', caption: '', description: '', editorial_order: '' };
  assert.equal(photoEditSchema.safeParse(data).success, true);
  assert.equal(photoEditSchema.safeParse({ ...data, status: 'published' }).success, false);
  assert.equal(photoEditSchema.safeParse({ ...data, featured: 'yes' }).success, false);
  assert.equal(photoEditSchema.safeParse({ ...data, status: 'published', classification: 'record', featured: 'yes', trip_id: randomUUID(), location_id: randomUUID() }).success, false);
});
test('API authorization rejects anonymous, unrelated users and cross-origin admin writes', async () => {
  const request = new Request('http://localhost/admin/photos/api/prepare', { method: 'POST', headers: { origin: 'http://localhost' } });
  let rpcCalls = 0;
  const client = (signedIn: boolean, admin: boolean) => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: randomUUID() } : null }, error: null }) }, rpc: async () => { rpcCalls++; return { data: admin, error: null }; } });
  assert.equal((await photoApiAccess(request, client(false,false)))?.status, 401); assert.equal(rpcCalls, 0);
  assert.equal((await photoApiAccess(request, client(true,false)))?.status, 403);
  assert.equal(await photoApiAccess(request, client(true,true)), null);
  const foreign = new Request(request.url, { method: 'POST', headers: { origin: 'https://foreign.example' } });
  assert.equal((await photoApiAccess(foreign,client(true,true)))?.status,403);
});
test('R2 config requires explicit server credentials and rejects missing configuration', () => {
  assert.throws(() => getR2Config({}));
  const values = { R2_ACCOUNT_ID: 'a'.repeat(32), R2_BUCKET_NAME: 'private-test', R2_ACCESS_KEY_ID: 'synthetic-test-id', R2_SECRET_ACCESS_KEY: 'synthetic-test-secret' };
  assert.equal(getR2Config(values).bucket, 'private-test');
  assert.equal(getR2Config(values).jurisdiction, 'default');
  assert.equal(getR2Config({ ...values, R2_JURISDICTION: 'eu' }).jurisdiction, 'eu');
  assert.throws(() => getR2Config({ ...values, R2_JURISDICTION: 'other' }));
  assert.throws(() => getR2Config({ ...values, R2_ACCOUNT_ID: 'https://foreign.example' }));
});
