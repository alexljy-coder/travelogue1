import { createPublicClient } from '@/lib/supabase/public';
import { createR2Storage, missingObject } from '@/lib/r2/storage';
import { deliverPublicImage } from '@/lib/photos/public-image';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; variant: string }> }) {
  const { id, variant } = await params;
  return deliverPublicImage(id, variant, {
    async visible(photoId) {
      // Anonymous even when the visitor has administrator cookies.
      const { data, error } = await createPublicClient().from('photos').select('id').eq('id', photoId).eq('status', 'published').maybeSingle();
      if (error) throw new Error('Visibility unavailable.');
      return !!data;
    },
    media: (photoId, representation) => createR2Storage().media(photoId, representation),
    missing: missingObject,
  });
}
