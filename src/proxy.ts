import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from '@/lib/supabase/env';
import type { Database } from '@/types/database';

// Refresh only admin sessions. Authorization remains in requireAdmin and database RLS.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');
  let config;
  try { config = getSupabaseConfig(); } catch { return response; }
  const supabase = createServerClient<Database>(config.url, config.publishableKey, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        response.headers.set('Cache-Control', 'private, no-store');
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = { matcher: ['/admin/:path*'] };
