/* Zukan image cache (v4.1, stage 1 of the image-speed program).
   Repeat views of Drive thumbnails are served from the device
   instead of the network: first display is unchanged (network),
   every later display of the same image is instant.
   Cache-first for Drive thumbnail / googleusercontent GETs only.
   Retry attempts carry a cache-buster (&retry=N) and always go
   to the network, so the app's failure recovery is untouched.
   The cache is pruned oldest-first past MAX_ENTRIES. Any failure
   in here degrades to plain network behavior — this worker can
   only ever help, never break the app. */
const CACHE = 'zukan-img-v1';
const MAX_ENTRIES = 900;
const PRUNE_TO = 800;

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function cacheable(u) {
  return (u.hostname === 'drive.google.com' && u.pathname.indexOf('/thumbnail') >= 0)
    || u.hostname.endsWith('.googleusercontent.com');
}

async function prune(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length > MAX_ENTRIES) {
      await Promise.all(keys.slice(0, keys.length - PRUNE_TO).map((k) => cache.delete(k)));
    }
  } catch (e) { /* pruning is best-effort */ }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let u;
  try { u = new URL(req.url); } catch (err) { return; }
  if (!cacheable(u)) return;
  if (u.search.indexOf('retry=') >= 0) return; /* cache-busted retry: network */
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      try { await cache.put(req, res.clone()); await prune(cache); } catch (err) { /* full/blocked cache: serve anyway */ }
    }
    return res;
  })());
});
