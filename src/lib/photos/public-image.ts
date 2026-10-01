import { isPhotoId } from '@/lib/data/public-photos';
import type { Variant } from './model';
export const publicVariants = ['tiny', 'thumbnail', 'medium', 'large'] as const;
export type PublicVariant = Exclude<Variant, 'source'>;
const headers = { 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
type Dependencies = {
  visible: (id: string) => Promise<boolean>;
  media: (id: string, variant: PublicVariant) => Promise<{ body: ReadableStream; contentType: string }>;
  missing: (error: unknown) => boolean;
};
export async function deliverPublicImage(id: string, variant: string, dependencies: Dependencies) {
  if (!isPhotoId(id) || !publicVariants.includes(variant as PublicVariant)) return new Response('Not found.', { status: 404, headers });
  try {
    if (!await dependencies.visible(id)) return new Response('Not found.', { status: 404, headers });
    const media = await dependencies.media(id.toLowerCase(), variant as PublicVariant);
    return new Response(media.body, { headers: { ...headers, 'Content-Type': 'image/webp', 'Content-Disposition': 'inline' } });
  } catch (error) {
    const status = dependencies.missing(error) ? 404 : 503;
    return new Response(status === 404 ? 'Not found.' : 'Image temporarily unavailable.', { status, headers });
  }
}
