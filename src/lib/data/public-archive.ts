import 'server-only';
import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/public';
import { attachContexts, orderedPhotos, PAGE_SIZE, queryPhoto, selectHomepagePhotos } from './public-photos';
export async function homepagePhotos() {
  try {
    const client = createPublicClient();
    const [featured, recent] = await Promise.all([
      orderedPhotos(client).eq('classification', 'nice').eq('featured', true).limit(9),
      orderedPhotos(client).eq('classification', 'nice').limit(9),
    ]);
    if (featured.error || recent.error) throw new Error('Public archive unavailable.');
    return { photos: await attachContexts(client, selectHomepagePhotos(featured.data ?? [], recent.data ?? [])), unavailable: false };
  } catch { return { photos: [], unavailable: true }; }
}
export async function galleryPhotos(classification: 'nice' | 'record', page: number) {
  try {
    const client = createPublicClient();
    const offset = (page - 1) * PAGE_SIZE;
    const { data, error } = await orderedPhotos(client).eq('classification', classification).range(offset, offset + PAGE_SIZE);
    if (error) throw new Error('Public archive unavailable.');
    return { photos: await attachContexts(client, (data ?? []).slice(0, PAGE_SIZE)), hasNext: (data?.length ?? 0) > PAGE_SIZE, unavailable: false };
  } catch { return { photos: [], hasNext: false, unavailable: true }; }
}
// Request-local metadata/page deduplication, never shared across visitors.
export const getPublicPhoto = cache(async (id: string) => {
  try { return await queryPhoto(createPublicClient(), id); }
  catch { throw new Error('The photograph is temporarily unavailable. Please try again later.'); }
});
