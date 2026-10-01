'use client';
export default function AdminError({ reset }: { reset: () => void }) {
  return <main><h1>Unable to load this record</h1><p role="alert">Check your connection and try again. No changes were made by loading this page.</p><button onClick={reset}>Try again</button></main>;
}
