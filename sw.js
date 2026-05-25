const CACHE = 'nutri-ai-v3';

// Relative paths — resolve against SW location (/nutri-ai/sw.js)
// so ./ === https://denisagasarov-sketch.github.io/nutri-ai/
const REQUIRED = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

const OPTIONAL = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      // Required assets must all succeed
      await c.addAll(REQUIRED);
      // Optional (CDN) — best effort, don't fail install if offline
      await Promise.allSettled(OPTIONAL.map(url =>
        fetch(url).then(r => { if (r.ok) c.put(url, r); }).catch(() => {})
      ));
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Never intercept OpenAI API calls
  if (e.request.url.includes('openai.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;

      return fetch(e.request)
        .then(resp => {
          if (resp.ok && e.request.method === 'GET') {
            caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          }
          return resp;
        })
        .catch(() => {
          // Offline fallback: serve index.html for navigation requests
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Офлайн', { status: 503 });
        });
    })
  );
});
