'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminNavigation() {
  const pathname = usePathname();
  return <nav className="admin-nav" aria-label="Archive administration">{[
    { href: '/admin', label: 'Dashboard' }, { href: '/admin/trips', label: 'Trips' }, { href: '/admin/locations', label: 'Locations' }, { href: '/admin/photos', label: 'Photos' }, { href:'/admin/hotels',label:'Hotels' },
  ].map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`)) ? 'page' : undefined}>{label}</Link>)}</nav>;
}
