// Offline first: alle Dateien der App werden beim ersten Besuch zwischengespeichert.
// Strategie "erst Netz, dann Speicher": Ist Internet da, kommt immer die neueste
// Version (und der Speicher wird aufgefrischt). Ohne Internet oder bei sehr
// langsamem Netz kommt die gespeicherte Version. So braucht es keinen Build-Schritt.
const CACHE = 'gnb-v1';
const NET_TIMEOUT = 3000;

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

function fromNetwork(req) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), NET_TIMEOUT);
    fetch(req, { cache: 'no-cache' }).then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const navigate = req.mode === 'navigate';
  const key = navigate ? 'index.html' : req;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const res = await fromNetwork(req);
        if (res.ok) await cache.put(key, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(key, { ignoreSearch: navigate });
        if (hit) return hit;
        throw err;
      }
    }),
  );
});
