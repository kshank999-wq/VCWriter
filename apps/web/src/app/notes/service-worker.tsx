'use client';

import { useEffect } from 'react';

/**
 * Registers the capture app's service worker.
 *
 * Its only job is to keep the capture screen itself openable with no
 * connection — the notes are already safe in IndexedDB, but a writer who taps
 * the home-screen icon underground should get the text box, not a browser
 * error page.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      void navigator.serviceWorker.register('/notes-sw.js', { scope: '/notes' }).catch(() => {
        // A failed registration costs offline shell caching and nothing else.
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
