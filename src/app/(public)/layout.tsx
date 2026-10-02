import Link from 'next/link';
import './public.css';
import { editorial, sans } from '@/app/fonts';
export const dynamic = 'force-dynamic';
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className={`public-site ${editorial.variable} ${sans.variable}`}><a className="skip-link" href="#archive-content">Skip to content</a>
    <header className="archive-header"><Link className="archive-name" href="/">FOUND ALONG</Link>
      <nav aria-label="Main navigation"><Link href="/photos">PHOTOS</Link><Link href="/trips">TRIPS</Link><Link href="/singapore">SINGAPORE</Link><Link href="/stays">STAYS</Link>{['MAP', 'ABOUT'].map((label) => <span key={label} aria-disabled="true" title="Coming in a later milestone">{label}</span>)}</nav>
    </header>{children}<footer className="archive-footer">FOUND ALONG · Photography and places by Alex Lim</footer>
  </div>;
}
