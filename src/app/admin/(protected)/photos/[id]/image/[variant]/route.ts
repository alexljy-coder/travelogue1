import { createSessionClient } from '@/lib/supabase/server';
import { photoApiAccess } from '@/lib/photos/api-boundary';
import { objectKey, variants, type Variant } from '@/lib/photos/model';
import { createR2Storage, missingObject } from '@/lib/r2/storage';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string; variant: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  let client;
  try { client = await createSessionClient(); } catch { return new Response(null, { status: 503, headers }); }
  const denied = await photoApiAccess(request, client);
  if (denied) return denied;
  const { id, variant } = await params;
  if (!z.uuid().safeParse(id).success || !variants.includes(variant as Variant)) return new Response(null, { status: 404, headers });
  const { data: photo, error } = await client.from('photos').select('storage_key,processing_status').eq('id', id).maybeSingle();
  if (error) return new Response(null, { status: 503, headers });
  if (!photo || photo.processing_status !== 'ready' || photo.storage_key !== `${id}/`) return new Response(null, { status: 404, headers });
  try {
    const media = await createR2Storage().media(id, variant as Variant);
    return new Response(media.body, { headers: { ...headers, 'Content-Type': media.contentType, 'Content-Disposition': `${variant === 'source' ? 'attachment' : 'inline'}; filename="${objectKey(id, variant as Variant).split('/')[1]}"` } });
  } catch (error) { return new Response(null, { status: missingObject(error) ? 404 : 503, headers }); }
}
