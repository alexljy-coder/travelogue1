import 'server-only';
import { redirect } from 'next/navigation';
import { createSessionClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/env';
import { checkAdmin } from './check-admin';

// Call inside every protected page and mutation, not only its layout.
export async function requireAdmin() {
  try { getSupabaseConfig(); } catch { redirect('/admin/login?issue=config'); }
  const client = await createSessionClient();
  const result = await checkAdmin(client);
  if (result.status !== 'admin') redirect(`/admin/login?issue=${result.status}`);
  return { client, userId: result.userId };
}
