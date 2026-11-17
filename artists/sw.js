/* v5.41.2: SELF-DESTRUCT worker — the zukan image cache is gone.
   This file used to be the v4.1 image cache (cache-first for
   Drive thumbnails / googleusercontent). It was removed because
   it is the prime suspect in the device image failure: it sat in
   front of every image request and stored any response that was
   ok-or-opaque — an error or interstitial page delivered through
   the thumbnail redirect counts as opaque, its status is
   unreadable, and once stored it was served cache-first forever.
   (Inference, not proof — the full chain is in the v5.41.2
   WORKLOG. What is proven: the same thumbnail URL opens fine
   directly in Safari on the user's device, so the failure lives
   inside the app context, not at the endpoint or the network.)
   On activate this worker deletes EVERY cache, unregisters
   itself, and reloads controlled pages so devices return to the
   plain network path at once. It has no fetch handler and
   intercepts nothing. */
self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (err) { /* best effort */ }
    try { await self.registration.unregister(); } catch (err) { /* best effort */ }
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => { try { c.navigate(c.url); } catch (err) { /* best effort */ } });
    } catch (err) { /* best effort */ }
  })());
});
