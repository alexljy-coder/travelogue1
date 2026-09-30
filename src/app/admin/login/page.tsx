import Link from 'next/link';
import { getSupabaseConfig } from '@/lib/supabase/env';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ issue?: string }> }) {
  const { issue } = await searchParams;
  let configured = true;
  try { getSupabaseConfig(); } catch { configured = false; }
  return (
    <main>
      <h1>Administrator sign in</h1>
      <p>This archive has one private administrator.</p>
      {!configured ? <p role="alert">Supabase is not configured. Follow the project setup instructions.</p> : <>
        {issue && <p role="status">Sign in with the provisioned administrator account. If access remains unavailable, check the project setup.</p>}
        <LoginForm />
      </>}
      <p><Link href="/">Return to the archive</Link></p>
    </main>
  );
}
