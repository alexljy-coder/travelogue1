'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ImportRecovery({ id }: { id: string }) {
  const [pending, setPending] = useState(false); const [message, setMessage] = useState(''); const router = useRouter();
  return <div><button disabled={pending} onClick={async () => {
    setPending(true);
    try {
      const response = await fetch('/admin/photos/api/cleanup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const result = await response.json(); setMessage(response.ok ? 'Storage cleaned. Reselect the JPEG to retry its import.' : result.error ?? 'Cleanup failed.'); router.refresh();
    } catch { setMessage('Unable to confirm cleanup. Refresh and try again.'); } finally { setPending(false); }
  }}>{pending ? 'Cleaning…' : 'Retry cleanup'}</button>{message && <p role="status">{message}</p>}</div>;
}
