import { createHash } from 'node:crypto';
import sharp from 'sharp';
import exifr from 'exifr';
import { derivativeEdges, derivativeSize, MAX_SOURCE_BYTES, MAX_SOURCE_PIXELS, webpQuality } from './model';

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : null;
const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
export function normalizeExif(raw: Record<string, unknown> = {}) {
  const original = text(raw.DateTimeOriginal);
  const date = original?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  const wall = date ? `${date[1]}-${date[2]}-${date[3]}T${date[4]}:${date[5]}:${date[6]}` : null;
  const parsed = wall ? new Date(`${wall}Z`) : null;
  const captured_at = wall && parsed && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 19) === wall && !wall.startsWith('0000') ? wall : null;
  const offset = text(raw.OffsetTimeOriginal)?.match(/^([+-])(\d{2}):(\d{2})$/);
  const minutes = offset && Number(offset[3]) < 60 ? (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === '-' ? -1 : 1) : null;
  const latitude = typeof raw.latitude === 'number' && Number.isFinite(raw.latitude) && Math.abs(raw.latitude) <= 90 ? raw.latitude : null;
  const longitude = typeof raw.longitude === 'number' && Number.isFinite(raw.longitude) && Math.abs(raw.longitude) <= 180 ? raw.longitude : null;
  const iso = positive(raw.ISO);
  const exposure = positive(raw.ExposureTime);
  const reciprocal = exposure !== null ? 1 / exposure : null;
  return {
    captured_at, captured_at_offset_minutes: captured_at && minutes !== null && Math.abs(minutes) <= 840 ? minutes : null,
    latitude: longitude !== null ? latitude : null, longitude: latitude !== null ? longitude : null,
    camera_make: text(raw.Make), camera_model: text(raw.Model), lens: text(raw.LensModel),
    focal_length: positive(raw.FocalLength), aperture: positive(raw.FNumber),
    shutter_speed: exposure === null ? null : exposure < 1 && reciprocal !== null && Math.abs(reciprocal - Math.round(reciprocal)) < 0.000001 ? `1/${Math.round(reciprocal)}` : `${exposure}s`,
    iso: iso !== null && Number.isInteger(iso) && iso <= 2147483647 ? iso : null,
  };
}
export async function processJpeg(source: Buffer, expectedHash: string, expectedSize: number) {
  if (source.length !== expectedSize || source.length > MAX_SOURCE_BYTES || createHash('sha256').update(source).digest('hex') !== expectedHash) throw new Error('Uploaded bytes do not match the selected file.');
  const options = { limitInputPixels: MAX_SOURCE_PIXELS, failOn: 'warning' as const };
  const metadata = await sharp(source, options).metadata();
  if (metadata.format !== 'jpeg' || !metadata.width || !metadata.height || metadata.space === 'cmyk') throw new Error('Use a valid RGB Lightroom JPEG within the 25 MiB and 80-megapixel safety limits.');
  const rotated = (metadata.orientation ?? 1) >= 5;
  const width = rotated ? metadata.height : metadata.width;
  const height = rotated ? metadata.width : metadata.height;
  let exif: Record<string, unknown> = {};
  try { exif = await exifr.parse(source, { reviveValues: false, translateValues: false, xmp: false, icc: false, iptc: false }) ?? {}; } catch { /* Optional EXIF failure must not invent metadata or block valid pixels. */ }
  const derivatives: { variant: keyof typeof derivativeEdges; bytes: Buffer }[] = [];
  const encoded = new Map<string, Buffer>();
  for (const [variant, edge] of Object.entries(derivativeEdges)) {
    // Sharp auto-orients, converts output to sRGB and strips EXIF/XMP/ICC by default.
    const dimensions = derivativeSize(width,height,edge);
    const identity = `${dimensions.width}x${dimensions.height}`;
    const bytes = encoded.get(identity) ?? await sharp(source, options).rotate().resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true }).webp({ quality: webpQuality[variant as keyof typeof webpQuality], effort: 4 }).timeout({ seconds: 15 }).toBuffer();
    encoded.set(identity,bytes);
    derivatives.push({ variant: variant as keyof typeof derivativeEdges, bytes });
  }
  return { metadata: { derivative_profile: 2, width, height, ...normalizeExif(exif) }, derivatives };
}
