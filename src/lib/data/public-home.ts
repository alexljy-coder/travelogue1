import 'server-only';
import { createPublicClient } from '@/lib/supabase/public';
import { singaporeOpening, singaporePhotos, singaporePlaces } from './public-singapore';
export async function homeArchive(pages: { photos: number; record: number; places: number }) {
  try {
    const client = createPublicClient();
    const [opening, nice, record, places] = await Promise.all([
      singaporeOpening(client), singaporePhotos(client, 'nice', pages.photos),
      singaporePhotos(client, 'record', pages.record), singaporePlaces(client, pages.places),
    ]);
    return { opening, nice, record, places, unavailable: false };
  } catch {
    return { opening: null, nice: { photos: [], hasNext: false }, record: { photos: [], hasNext: false }, places: { places: [], hasNext: false }, unavailable: true };
  }
}
