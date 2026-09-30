import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { getSupabaseConfig } from './env';

export async function createSessionClient() {
  const { url, publishableKey } = getSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, publishableKey, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. The /admin proxy handles refresh.
        }
      },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
}
