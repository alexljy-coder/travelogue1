import { createSessionClient } from '@/lib/supabase/server';
import { photoApiAccess } from '@/lib/photos/api-boundary';
import { createR2Storage } from '@/lib/r2/storage';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  let client;
  try { client = await createSessionClient(); } catch { return Response.json({ error: 'Supabase is not configured.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } }); }
  const denied = await photoApiAccess(request, client);
  if (denied) return denied;
  try {
    await createR2Storage().connectivity();
    return Response.json({ ok: true, message: 'Private R2 bucket is reachable. A test import will verify write/delete permissions.' }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'R2 connectivity failed. Check the four server-side variables and bucket-scoped Object Read & Write permission.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
