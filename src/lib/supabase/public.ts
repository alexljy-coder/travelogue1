import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getSupabaseConfig } from './env';

// No cookies or session inheritance: public rendering always receives anonymous privileges.
export function createPublicClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
}
