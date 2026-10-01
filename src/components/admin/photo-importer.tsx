'use client';

import Link from 'next/link';
import { useState, type InputHTMLAttributes } from 'react';
import { useRouter } from 'next/navigation';
import { scanFiles, type Classification } from '@/lib/photos/model';

type Entry = { id: string; file: File; path: string; classification: Classification; status: string; photoId?: string; error?: string };
async function api(operation: string, body: unknown) {
  const response = await fetch(`/admin/photos/api/${operation}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let result;
  try { result = await response.json(); } catch { throw new Error('The server response could not be confirmed. Refresh import status before retrying.'); }
  if (!response.ok) throw new Error(result.error ?? 'Import request failed. Refresh its status before retrying.');
  return result;
}
export function PhotoImporter() {
  const [files, setFiles] = useState<File[]>([]); const [entries, setEntries] = useState<Entry[]>([]);
  const [fallback, setFallback] = useState<Classification | ''>(''); const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<string[]>([]); const [skipped, setSkipped] = useState(0);
  const [batchId, setBatchId] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const router = useRouter();
  function selectFiles(selected: File[], choice = fallback) {
    const scan = scanFiles(selected, choice || undefined);
    setFiles(selected); setEntries(scan.eligible.map((entry) => ({ ...entry, id: crypto.randomUUID(), status: 'Ready' })));
    setErrors(scan.errors); setSkipped(scan.skipped.length); setBatchId(crypto.randomUUID()); setMessage(''); setConfirmed(false);
  }
  const needsConfirmation = files.some((file) => !file.webkitRelativePath);
  async function run() {
    setBusy(true); setMessage('');
    const current = [...entries];
    try {
      await api('batch', { id: batchId, source_name: 'Lightroom JPEG export', total: files.length, eligible: entries.length, skipped });
      for (let index = 0; index < current.length; index++) {
        const entry = current[index]; if (entry.status === 'Imported' || entry.status === 'Already imported') continue;
        const update = (patch: Partial<Entry>) => { current[index] = { ...current[index], ...patch }; setEntries([...current]); };
        update({ status: 'Reading eligible JPEG…', error: undefined });
        try {
          // scanFiles excluded Personal BEFORE any arrayBuffer/hash/read or network upload.
          const bytes = await entry.file.arrayBuffer();
          const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((value) => value.toString(16).padStart(2, '0')).join('');
          const prepared = await api('prepare', { id: entry.id, batch_id: batchId, filename: entry.file.name, path: entry.path, classification: entry.classification, file_hash: hash, file_size: entry.file.size });
          update({ photoId: prepared.id });
          if (prepared.existing) { update({ status: 'Already imported' }); continue; }
          update({ status: 'Uploading private source…' });
          try {
            const upload = await fetch(prepared.url, { method: 'PUT', body: entry.file, credentials: 'omit', headers: { 'Content-Type': 'image/jpeg' } });
            if (!upload.ok) throw new Error('Source upload failed.');
          } catch {
            let clean = true;
            try { await api('cancel', { id: prepared.id, token: prepared.token }); } catch { clean = false; }
            throw new Error(clean ? 'Source upload failed and was cancelled. Check bucket CORS and retry.' : 'Source upload failed; cleanup is unconfirmed. Check import status before retrying.');
          }
          update({ status: 'Verifying source and generating derivatives…' });
          await api('process', { id: prepared.id, token: prepared.token });
          update({ status: 'Imported' });
        } catch (error) { update({ status: 'Failed', error: error instanceof Error ? error.message : 'Unable to confirm import.' }); }
      }
      await api('finish', { id: batchId, failed: current.some((entry) => entry.status === 'Failed') });
      setMessage(`${current.filter((entry) => entry.status === 'Imported').length} imported; ${current.filter((entry) => entry.status === 'Already imported').length} already existed; ${current.filter((entry) => entry.status === 'Failed').length} failed. New Photos are Draft. Refresh status after uncertain network failures.`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to start import.'); }
    finally { setBusy(false); router.refresh(); }
  }
  return <section className="editor">
    <p>Import at most 10 Lightroom-exported sRGB JPEGs, up to 4000px long edge and 25 MiB each. Sources remain private; every new Photo is Draft.</p>
    <p>Choose the export root folder to retain <strong>01 Nice / 02 Record Shots / 03 Personal</strong> paths. Personal is skipped before file contents are read. Dropping loose files uses your explicit choice below.</p>
    <div className="field"><label htmlFor="import-fallback">Classification for files without a recognized folder</label><select id="import-fallback" value={fallback} disabled={busy} onChange={(event) => { const choice = event.target.value as Classification | ''; setFallback(choice); selectFiles(files, choice); }}><option value="">Choose explicitly</option><option value="nice">Nice</option><option value="record">Record</option></select></div>
    <div className="field"><label htmlFor="import-files">Select JPEG files</label><input id="import-files" type="file" accept="image/jpeg,.jpg,.jpeg" multiple disabled={busy} onChange={(event) => selectFiles(Array.from(event.target.files ?? []))} /></div>
    <div className="field"><label htmlFor="import-folder">Select export folder (supported browsers)</label><input id="import-folder" type="file" multiple disabled={busy} {...({ webkitdirectory: '', directory: '' } as InputHTMLAttributes<HTMLInputElement>)} onChange={(event) => selectFiles(Array.from(event.target.files ?? []))} /></div>
    <div className="drop-area" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!busy) selectFiles(Array.from(event.dataTransfer.files)); }}>Drop loose JPEGs here. For folders, use the folder picker so paths are preserved.</div>
    {needsConfirmation && <label className="checkbox"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} />These selected loose files contain no Personal photos. Their original folder classification is unavailable.</label>}
    <p>{entries.length} eligible · {skipped} Personal skipped</p>
    {errors.length > 0 && <div role="alert" className="error"><p>Correct the selection before importing:</p><ul>{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
    {entries.length > 0 && <ul className="import-results">{entries.map((entry) => <li key={entry.id}><strong>{entry.file.name}</strong> · {entry.classification} · {entry.status}{entry.photoId && ['Imported','Already imported'].includes(entry.status) && <> · <Link href={`/admin/photos/${entry.photoId}`}>Edit Photo</Link></>}{entry.error && <p className="error">{entry.error}</p>}</li>)}</ul>}
    <button disabled={busy || !entries.length || !!errors.length || (needsConfirmation && !confirmed)} onClick={run}>{busy ? 'Importing one photo at a time…' : 'Import / retry failed files'}</button>
    {message && <p role="status">{message}</p>}
    <p className="hint">Do not close the page during upload. A lost response does not prove failure; use the import status below. Retrying identical bytes reuses their existing request/Photo, never replaces it.</p>
    <button disabled={busy} onClick={async () => {
      try { const response = await fetch('/admin/photos/storage'); const result = await response.json(); setMessage(result.message ?? result.error ?? 'Connectivity could not be confirmed.'); } catch { setMessage('Unable to check R2 connectivity.'); }
    }}>Check R2 connectivity</button>
  </section>;
}
