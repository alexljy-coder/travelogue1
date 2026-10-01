import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminNavigation } from '@/components/admin/navigation';
import { signOut } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <div className="admin">
    <header><Link href="/admin">Travel archive · Admin</Link><form action={signOut}><button type="submit">Sign out</button></form></header>
    <AdminNavigation />
    {children}
  </div>;
}
