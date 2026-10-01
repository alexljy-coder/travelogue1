import { checkAdmin, type AdminAuthClient } from '@/lib/auth/check-admin';

// Runs before body parsing, storage construction or any upload signing.
export async function photoApiAccess(request: Request, client: AdminAuthClient) {
  const auth = await checkAdmin(client);
  if (auth.status !== 'admin') return Response.json({ error: auth.status === 'forbidden' ? 'Administrator access required.' : 'Sign in as the administrator.' }, { status: auth.status === 'forbidden' ? 403 : auth.status === 'unavailable' ? 503 : 401, headers: { 'Cache-Control': 'private, no-store' } });
  if (request.method !== 'GET' && request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Use this application to submit imports.' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
  return null;
}
