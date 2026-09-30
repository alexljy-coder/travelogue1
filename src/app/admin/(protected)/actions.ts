'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function signOut() {
  const { client } = await requireAdmin();
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw new Error('Unable to sign out. Please try again.');
  redirect('/admin/login');
}
