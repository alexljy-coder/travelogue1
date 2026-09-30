'use server';

import { redirect } from 'next/navigation';
import { createSessionClient } from '@/lib/supabase/server';
import { checkAdmin } from '@/lib/auth/check-admin';
import { loginSchema } from '@/lib/validation/login';

export type LoginState = { error: string | null };

export async function signIn(_state: LoginState, formData: FormData): Promise<LoginState> {
  const input = loginSchema.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!input.success) return { error: 'Enter a valid email and password.' };
  try {
    const client = await createSessionClient();
    const { error } = await client.auth.signInWithPassword(input.data);
    if (error) return { error: 'Unable to sign in with these credentials.' };
    const result = await checkAdmin(client);
    if (result.status !== 'admin') {
      await client.auth.signOut({ scope: 'local' });
      return { error: 'Administrator access is unavailable for this account.' };
    }
  } catch {
    return { error: 'Sign-in is unavailable. Please try again later.' };
  }
  // Outside catch: Next.js redirects intentionally throw.
  redirect('/admin');
}
