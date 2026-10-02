import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Found Along', description: 'Photography and places by Alex Lim' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
