'use client';

import dynamic from 'next/dynamic';

/**
 * The capture screen is client-only by nature: it reads IndexedDB, the speech
 * API and a service worker, none of which exist on the server. Loading it with
 * `ssr: false` keeps the build from prerendering a screen that can only
 * meaningfully exist in a browser — and keeps a Supabase client out of the
 * build step.
 */
const CaptureApp = dynamic(() => import('./capture-app'), {
  ssr: false,
  loading: () => (
    <div className="notes">
      <p className="muted">Loading…</p>
    </div>
  ),
});

export default function NotesPage() {
  return <CaptureApp />;
}
