/**
 * VC Writer Notes service worker.
 *
 * Deliberately small. Captures are kept safe by IndexedDB in the page, not by
 * this file; all this does is make sure the capture screen opens with no
 * connection, and that a stale shell is never served once a new one exists.
 *
 * Network-first for navigations so a deployed change is picked up promptly,
 * falling back to the cached shell when the network is gone.
 */

const CACHE = 'vcwriter-notes-v1';
const SHELL = ['/notes'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never cache Supabase or any other origin: capture data must not be served
  // from a stale copy.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put('/notes', copy));
          return response;
        })
        .catch(() => caches.match('/notes').then((cached) => cached ?? Response.error())),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
