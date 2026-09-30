import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Travel archive', description: 'A personal visual travel archive.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
