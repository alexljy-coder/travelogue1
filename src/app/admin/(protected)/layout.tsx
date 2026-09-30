import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { signOut } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>
    <header><Link href="/">Travel archive</Link><form action={signOut}><button type="submit">Sign out</button></form></header>
    {children}
  </>;
}
