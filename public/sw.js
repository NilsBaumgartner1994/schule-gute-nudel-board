// Offline first: alle Dateien der App werden beim ersten Besuch zwischengespeichert.
// BUILD wird beim Veröffentlichen automatisch durch die Commit-ID ersetzt,
// dadurch bekommt jede neue Version einen frischen Cache.
const BUILD = '__BUILD__';
const CACHE = `gnb-${BUILD}`;

const FILES = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/codec.js',
  'js/shapes.js',
  'vendor/qrcode.mjs',
  'fonts/andika-latin-400-normal.woff2',
  'fonts/andika-latin-700-normal.woff2',
  'fonts/andika-latin-ext-400-normal.woff2',
  'fonts/andika-latin-ext-700-normal.woff2',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gnb-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // Seitenaufrufe (auch mit ?…) immer aus der gespeicherten index.html bedienen
      const key = req.mode === 'navigate' ? 'index.html' : req;
      const hit = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        if (req.mode === 'navigate') {
          const fallback = await cache.match('index.html');
          if (fallback) return fallback;
        }
        throw err;
      }
    }),
  );
});
