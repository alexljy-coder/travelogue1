'use client';
export default function PublicError({ reset }: { reset: () => void }) {
  return <main id="archive-content" className="archive-main archive-empty"><h1>The archive is temporarily unavailable.</h1><p>Please try again later.</p><button onClick={reset}>Try again</button></main>;
}
